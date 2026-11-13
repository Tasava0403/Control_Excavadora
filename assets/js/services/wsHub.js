import { CONFIG } from '../config.js';
import { VehicleSocket } from './wsClient.js';

// UNA sola conexión WSS compartida por CONTROL y MONITOREO.
// Los eventos JSON de otro vehículo se descartan aquí; los códigos en texto plano llegan por el
// canal del vehículo (la URL ya lo identifica).
const subs = new Set();
let socket = null;
const emit = (e) => subs.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });

export const wsHub = {
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  start() {
    if (socket) return;
    socket = new VehicleSocket(CONFIG.WSS_URL, {
      backoff: CONFIG.WS_BACKOFF,
      onStatus: (estado) => emit({ tipo: 'status', estado }),
      onMessage: (m) => {
        if (m.tipo === 'json' && m.data?.id_vehiculo !== undefined && m.data.id_vehiculo !== CONFIG.VEHICLE_ID) return;
        emit(m);
      },
    });
    socket.connect();
  },
};
