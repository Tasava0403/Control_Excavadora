import { createStore } from './store.js';

// fase: cargando | ok | vacio | error · origen: rest | wss | demo
export const monitor = createStore({
  estado: { fase: 'cargando', datos: null, origen: null, error: null },
  historial: { fase: 'cargando', filas: [], aviso: null, error: null },
  demo: { fase: 'inactiva', idDemo: null, total: 0, paso: 0, marca: null }, // inactiva|ejecutando|finalizada|cancelada|error
});
