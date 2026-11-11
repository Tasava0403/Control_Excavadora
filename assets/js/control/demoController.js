import { CONFIG } from '../config.js';
import { store, notificar } from '../state/store.js';
import { vehicleApi } from '../services/vehicleApi.js';
import { mensajeUsuario } from '../utils/errors.js';

const INACTIVA = { estado: 'inactiva', idDemo: null, total: 0, progreso: 0 };

export class DemoController {
  #guard = null;

  async cargar() {
    try {
      const lista = await vehicleApi.listarDemos(CONFIG.VEHICLE_ID);
      const demos = (Array.isArray(lista) ? lista : [])
        .filter((d) => Number.isInteger(d?.id_demo) && d.activo !== 0 && d.activo !== false)
        .map((d) => ({ id_demo: d.id_demo, nombre: String(d.nombre ?? `DEMO ${d.id_demo}`) }));
      store.set({ demos, demosEstado: 'ok' });
    } catch (e) {
      store.set({ demosEstado: 'error' });
      notificar(`No se pudieron cargar las DEMO. ${mensajeUsuario(e)}`, 'error');
    }
  }

  async iniciar(idDemo) {
    if (store.get().demo.estado !== 'inactiva') return; // evita doble inicio
    store.set({ demo: { ...INACTIVA, estado: 'iniciando', idDemo } });
    try {
      const r = await vehicleApi.iniciarDemo(CONFIG.VEHICLE_ID, idDemo);
      const movs = Array.isArray(r?.movimientos) ? r.movimientos : [];
      const ms = movs.reduce((t, m) => t + (+m.duracion_ms || 0) + (+m.pausa_ms || 0), 0);
      store.set({ demo: { estado: 'ejecutando', idDemo, total: r?.total_movimientos ?? movs.length, progreso: 0 } });
      this.#armarGuarda(ms + 8000);
    } catch (e) {
      this.#fin(); notificar(mensajeUsuario(e), 'error');
    }
  }

  async cancelar() {
    if (store.get().demo.estado === 'inactiva') return;
    store.set({ demo: { ...store.get().demo, estado: 'cancelando' } });
    this.#armarGuarda(6000);
    try { await vehicleApi.cancelarDemo(CONFIG.VEHICLE_ID); }
    catch (e) {
      if (e.kind === 'http' && e.status === 404) return this.#fin(); // no había DEMO activa
      notificar(mensajeUsuario(e), 'error'); throw e;
    }
  }

  onCodigo() {
    const d = store.get().demo;
    if (d.estado === 'ejecutando') store.set({ demo: { ...d, progreso: d.progreso + 1 } });
  }

  onEvento(ev) {
    const tipo = ev?.tipo_evento;
    if (tipo === 'INICIO_DEMO' && store.get().demo.estado === 'iniciando') store.set({ demo: { ...store.get().demo, estado: 'ejecutando' } });
    if (tipo === 'FIN_DEMO') { this.#fin(); notificar('DEMO finalizada (evento recibido).'); }
    if (tipo === 'CANCELACION_DEMO') { this.#fin(); notificar('DEMO cancelada (evento recibido).'); }
    if (tipo === 'ERROR_DEMO') { this.#fin(); notificar('El servidor reportó un error en la DEMO.', 'error'); }
  }

  // Salvaguarda: si el evento final nunca llega (p. ej. WSS caído), la UI no queda bloqueada.
  #armarGuarda(ms) { clearTimeout(this.#guard); this.#guard = setTimeout(() => this.#fin(), ms); }
  #fin() { clearTimeout(this.#guard); store.set({ demo: { ...INACTIVA } }); }
}
