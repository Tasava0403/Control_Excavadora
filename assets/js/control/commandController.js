import { CONFIG, COMMANDS, TOGGLE_COMMANDS } from '../config.js';
import { store, notificar } from '../state/store.js';
import { vehicleApi } from '../services/vehicleApi.js';
import { mensajeUsuario } from '../utils/errors.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Única lógica de comandos: la usan joysticks y botones.
// - dedupe: solo se envía al cambiar el comando efectivo del joystick.
// - coalescing: con una solicitud de joystick en vuelo, solo se guarda la última.
// - DETENER: aborta lo pendiente, invalida respuestas viejas (epoch/seq) y cancela la DEMO.
// - pulso (LED y sonido): código 9/10 un instante y regreso al estado 11 (o al movimiento activo).
export class CommandController {
  #seq = 0; #epoch = 0; #busy = false; #queued = null; #effective = null; #pulsando = false; #ctrls = new Set();
  constructor(demo) { this.demo = demo; }

  #cmd(nombre) { return store.get().comandos[nombre] ?? null; }
  #patch(seq, p) { const a = store.get().accion; if (a && a.seq === seq) store.set({ accion: { ...a, ...p } }); }

  joystick(mapa, dir) { return dir ? this.enviar(mapa[dir], { dedupe: true }) : this.detener({ dedupe: true }); }

  async enviar(nombre, { dedupe = false } = {}) {
    if (nombre === COMMANDS.STOP) return this.detener();
    if (TOGGLE_COMMANDS.includes(nombre)) return this.pulsar(nombre);
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

  // Pulso: envía 9 (LED) o 10 (sonido), espera un instante y regresa al estado 11.
  // Si un joystick sigue activo, vuelve a ese movimiento en lugar de detenerlo.
  async pulsar(nombre) {
    const cmd = this.#cmd(nombre);
    if (!cmd) return notificar('Comando no disponible en el catálogo.', 'error');
    if (store.get().demo.estado !== 'inactiva') return notificar('Hay una DEMO en curso. Usa DETENER para cancelarla.');
    if (this.#pulsando) return; // evita rebotes y pulsos superpuestos
    this.#pulsando = true;
    const epoch = this.#epoch;
    try {
      if (await this.#despachar(cmd)) {
        store.set((s) => ({ toggles: { ...s.toggles, [nombre]: !s.toggles[nombre] } }));
      }
      await esperar(CONFIG.PULSE_MS);
      if (epoch !== this.#epoch) return; // DETENER ya envió el estado 11
      const activo = this.#effective && this.#effective !== COMMANDS.STOP ? this.#cmd(this.#effective) : null;
      const volver = activo ?? this.#cmd(COMMANDS.STOP);
      if (volver) await this.#despachar(volver, { silencioso: true });
    } finally { this.#pulsando = false; }
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

  // Devuelve true si la API aceptó la solicitud. "silencioso" no toca la evidencia de la acción mostrada.
  async #despachar(cmd, { silencioso = false } = {}) {
    const seq = silencioso ? this.#seq : ++this.#seq, epoch = this.#epoch, ctrl = new AbortController();
    this.#ctrls.add(ctrl);
    if (!silencioso) {
      store.set({ accion: { nombre: cmd.nombre, codigo: cmd.codigo, seq, solicitado: true, aceptado: false, evento: false, error: null } });
    }
    try {
      await vehicleApi.enviarMovimiento(CONFIG.VEHICLE_ID, cmd.id_comando, { signal: ctrl.signal });
      if (epoch !== this.#epoch) return false;
      if (!silencioso) this.#patch(seq, { aceptado: true });
      return true;
    } catch (e) {
      if (epoch !== this.#epoch || (!silencioso && seq !== this.#seq)) return false; // respuesta tardía: se ignora
      if (!silencioso) this.#patch(seq, { error: mensajeUsuario(e) });
      notificar(mensajeUsuario(e), 'error');
      return false;
    } finally { this.#ctrls.delete(ctrl); }
  }

  // Evidencia: llegó por WSS el código de la acción actual (no prueba ejecución física).
  onCodigo(codigo) {
    const a = store.get().accion;
    if (a && !a.evento && !a.error && a.codigo === codigo) this.#patch(a.seq, { evento: true });
  }
}
