// Estado de interfaz: un objeto inmutable con suscriptores.
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      subs.forEach((fn) => fn(state));
    },
    subscribe(fn) { subs.add(fn); fn(state); return () => subs.delete(fn); },
  };
}

export const store = createStore({
  vehiculo: { nombre: null },
  comandos: {},            // nombre -> { id_comando, codigo, nombre }
  demos: [],               // [{ id_demo, nombre }]
  demosEstado: 'cargando', // cargando | ok | error
  demo: { estado: 'inactiva', idDemo: null, total: 0, progreso: 0 }, // inactiva|iniciando|ejecutando|cancelando
  ws: 'conectando',        // en_linea | conectando | reconectando | desconectado
  aws: 'comprobando',      // disponible | comprobando | no_disponible
  rds: 'sin_verificar',    // disponible | no_disponible | sin_verificar
  toggles: { CONTROL_LED: false, CONTROL_SONIDO: false }, // estado ESTIMADO (la API no lo informa)
  accion: null,            // { nombre, codigo, seq, solicitado, aceptado, evento, error }
  mensaje: null,           // { texto, nivel }
});

export const notificar = (texto, nivel = 'info') => store.set({ mensaje: { texto, nivel } });
