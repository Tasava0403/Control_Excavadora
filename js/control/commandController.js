import { CONFIG, COMMANDS } from '../config.js';
import { store, notificar } from '../state/store.js';
import { vehicleApi } from '../services/vehicleApi.js';
import { mensajeUsuario } from '../utils/errors.js';

// Única lógica de comandos: la usan joysticks y botones.
// - dedupe: solo se envía al cambiar el comando efectivo del joystick.
// - coalescing: con una solicitud de joystick en vuelo, solo se guarda la última.
// - DETENER: aborta lo pendiente, invalida respuestas viejas (epoch/seq) y cancela la DEMO.
export class CommandController {
  #seq = 0; #epoch = 0; #busy = false; #queued = null; #effective = null; #ctrls = new Set();
  constructor(demo) { this.demo = demo; }

  #cmd(nombre) { return store.get().comandos[nombre] ?? null; }
  #patch(seq, p) { const a = store.get().accion; if (a && a.seq === seq) store.set({ accion: { ...a, ...p } }); }

  joystick(mapa, dir) { return dir ? this.enviar(mapa[dir], { dedupe: true }) : this.detener({ dedupe: true }); }

  async enviar(nombre, { dedupe = false } = {}) {
    if (nombre === COMMANDS.STOP) return this.detener();
    const cmd = this.#cmd(nombre);
    if (!cmd) return notificar('Comando no disponible en el catálogo.', 'error');
    if (store.get().demo.estado !== 'inactiva') return notificar('Hay una DEMO en curso. Usa DETENER para cancelarla.');
    if (!dedupe) return this.#despachar(cmd);
    if (this.#effective === nombre) return;
    this.#effective = nombre;
    if (this.#busy) { this.#queued = cmd; return; }
    this.#busy = true;
    try { for (let c = cmd; c; c = this.#queued, this.#queued = null) await this.#despachar(c); }
    finally { this.#busy = false; }
  }

  async detener({ dedupe = false } = {}) {
    if (dedupe && this.#effective === COMMANDS.STOP) return;
    const cmd = this.#cmd(COMMANDS.STOP);
    if (!cmd) return notificar('DETENER no está en el catálogo de comandos.', 'error');
    this.#epoch++; this.#queued = null; this.#effective = COMMANDS.STOP;
    this.#ctrls.forEach((c) => c.abort()); this.#ctrls.clear();
    const cancelacion = store.get().demo.estado !== 'inactiva' ? this.demo.cancelar().catch(() => {}) : null;
    await this.#despachar(cmd);
    await cancelacion;
  }

  async #despachar(cmd) {
    const seq = ++this.#seq, epoch = this.#epoch, ctrl = new AbortController();
    this.#ctrls.add(ctrl);
    store.set({ accion: { nombre: cmd.nombre, codigo: cmd.codigo, seq, solicitado: true, aceptado: false, evento: false, error: null } });
    try {
      await vehicleApi.enviarMovimiento(CONFIG.VEHICLE_ID, cmd.id_comando, { signal: ctrl.signal });
      if (epoch === this.#epoch) this.#patch(seq, { aceptado: true });
    } catch (e) {
      if (epoch !== this.#epoch || seq !== this.#seq) return; // respuesta tardía: se ignora
      this.#patch(seq, { error: mensajeUsuario(e) });
      notificar(mensajeUsuario(e), 'error');
    } finally { this.#ctrls.delete(ctrl); }
  }

  // Evidencia: llegó por WSS el código de la acción actual (no prueba ejecución física).
  onCodigo(codigo) {
    const a = store.get().accion;
    if (a && !a.evento && !a.error && a.codigo === codigo) this.#patch(a.seq, { evento: true });
  }
}
