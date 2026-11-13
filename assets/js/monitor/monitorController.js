import { CONFIG } from '../config.js';
import { store } from '../state/store.js';
import { monitor } from '../state/monitorStore.js';
import { vehicleApi } from '../services/vehicleApi.js';
import { validarEstado, normalizarHistorial } from '../utils/validators.js';
import { ApiError, mensajeUsuario } from '../utils/errors.js';

const ID = CONFIG.VEHICLE_ID;
const catalogo = () => Object.values(store.get().comandos);
const nombrePorCodigo = (c) => catalogo().find((x) => x.codigo === c)?.nombre ?? null;

// Estrategia:
// - REST carga estado e historial al entrar y tras reconectar WSS.
// - WSS DISPARA la sincronización (con debounce); no hay polling.
// - Cada solicitud lleva token: una respuesta vieja nunca reemplaza a una más nueva (y se aborta la previa).
// - #version cuenta eventos WSS: si llegó uno durante la consulta, la respuesta se descarta y se reprograma.
// - Eventos internos de DEMO no disparan consulta de historial (no se persisten ahí).
export class MonitorController {
  #activa = false; #version = 0; #tokE = 0; #tokH = 0; #abE = null; #abH = null;
  #timer = null; #pend = { estado: false, historial: false };
  #primero = false; #cayo = false; #reintento = false;

  activar() { this.#activa = true; this.#programar({ estado: true, historial: true }, 0); }

  desactivar() {
    this.#activa = false; clearTimeout(this.#timer); this.#pend = { estado: false, historial: false };
    this.#abE?.abort(); this.#abH?.abort();
  }

  onWs(e) {
    if (e.tipo === 'status') {
      if (e.estado === 'desconectado') this.#cayo = true;
      if (e.estado === 'en_linea') {
        this.#primero = true; // el primer mensaje tras abrir es el estado inicial, no un movimiento nuevo
        if (this.#cayo) { this.#cayo = false; if (this.#activa) this.#programar({ estado: true, historial: true }, 0); }
      }
    } else if (e.tipo === 'codigo') this.#codigo(e.codigo);
    else if (e.tipo === 'json') this.#evento(e.data);
  }

  #codigo(c) {
    if (!Number.isInteger(c)) return;
    const inicial = this.#primero; this.#primero = false;
    this.#version++; this.#reintento = false;
    const m = monitor.get(), provisional = { codigo: c, comando: nombrePorCodigo(c), fecha: null };
    if (m.demo.fase === 'ejecutando') { // paso de DEMO: estado en vivo, sin tocar el historial
      monitor.set({ demo: { ...m.demo, paso: m.demo.paso + 1 }, estado: { fase: 'ok', datos: provisional, origen: 'demo', error: null } });
      return;
    }
    monitor.set({ estado: { fase: 'ok', datos: provisional, origen: 'wss', error: null } });
    if (this.#activa) this.#programar({ estado: true, historial: !inicial });
  }

  #evento(ev) {
    const d = monitor.get().demo, marca = typeof ev?.marca_temporal === 'string' ? ev.marca_temporal : null;
    const fin = { FIN_DEMO: 'finalizada', CANCELACION_DEMO: 'cancelada', ERROR_DEMO: 'error' }[ev?.tipo_evento];
    if (ev?.tipo_evento === 'INICIO_DEMO') {
      this.#version++;
      monitor.set({ demo: { fase: 'ejecutando', idDemo: ev.id_demo ?? null, total: Number.isInteger(ev.total_movimientos) ? ev.total_movimientos : 0, paso: 0, marca } });
    } else if (fin) {
      monitor.set({ demo: { ...d, fase: fin, marca } });
      if (this.#activa) this.#programar({ estado: true, historial: true }); // confirma que el historial no cambió
    }
  }

  #programar(flags, ms = CONFIG.SYNC_DEBOUNCE_MS) {
    this.#pend = { estado: this.#pend.estado || !!flags.estado, historial: this.#pend.historial || !!flags.historial };
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      const p = this.#pend; this.#pend = { estado: false, historial: false };
      if (p.estado) this.#syncEstado();
      if (p.historial) this.#syncHistorial(true);
    }, ms);
  }

  async #syncEstado() {
    this.#abE?.abort(); const ctrl = (this.#abE = new AbortController());
    const tok = ++this.#tokE, v = this.#version;
    if (!monitor.get().estado.datos) monitor.set({ estado: { fase: 'cargando', datos: null, origen: null, error: null } });
    try {
      const val = validarEstado(await vehicleApi.obtenerEstado(ID, { signal: ctrl.signal }), ID);
      if (tok !== this.#tokE || val.tipo === 'otro_vehiculo') return;
      if (val.tipo === 'sin_estado') return monitor.set({ estado: { fase: 'vacio', datos: null, origen: null, error: null } });
      if (val.tipo !== 'ok') throw new ApiError('invalid', 'Estado inválido');
      if (v !== this.#version) return this.#programar({ estado: true }); // hay un evento más nuevo: esta respuesta pudo quedar vieja
      const act = monitor.get().estado.datos;
      if (act?.fecha && val.estado.fecha && val.estado.fecha.ms < act.fecha.ms) return; // respuesta anterior a lo mostrado
      monitor.set({ estado: { fase: 'ok', datos: val.estado, origen: 'rest', error: null } });
    } catch (e) {
      if (tok !== this.#tokE || e.kind === 'aborted') return;
      monitor.set({ estado: { ...monitor.get().estado, fase: 'error', error: mensajeUsuario(e) } });
    }
  }

  async #syncHistorial(porEvento = false) {
    this.#abH?.abort(); const ctrl = (this.#abH = new AbortController());
    const tok = ++this.#tokH, antes = monitor.get().historial.filas[0]?.key;
    if (!monitor.get().historial.filas.length) monitor.set({ historial: { fase: 'cargando', filas: [], aviso: null, error: null } });
    try {
      const crudo = await vehicleApi.obtenerHistorial(ID, { signal: ctrl.signal });
      if (tok !== this.#tokH) return;
      const porCodigo = Object.fromEntries(catalogo().map((c) => [c.codigo, c.nombre]));
      const { filas, aviso } = normalizarHistorial(crudo, ID, porCodigo);
      monitor.set({ historial: { fase: filas.length ? 'ok' : 'vacio', filas, aviso, error: null } });
      // Persistencia no asumida: si tras un evento el historial no cambió, una sola re-consulta acotada.
      if (porEvento && !this.#reintento && filas[0]?.key === antes) {
        this.#reintento = true;
        setTimeout(() => { if (this.#activa) this.#syncHistorial(false); }, CONFIG.SYNC_RETRY_MS);
      }
    } catch (e) {
      if (tok !== this.#tokH || e.kind === 'aborted') return;
      monitor.set({ historial: { ...monitor.get().historial, fase: 'error', error: e.kind === 'invalid' ? 'El formato del historial no coincide con el esperado.' : mensajeUsuario(e) } });
    }
  }
}
