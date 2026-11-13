import { CONFIG } from '../config.js';
import { request } from './restClient.js';

// Una función por endpoint documentado. Los movimientos se envían SIEMPRE por POST.
export const vehicleApi = {
  obtenerVehiculo: (id) => request(`/vehiculos/${id}`),
  listarComandos: (id) => request(`/comandos/vehiculo/${id}`),
  listarDemos: (id) => request(`/demos/vehiculo/${id}`),
  enviarMovimiento: (id, idComando, opts = {}) =>
    request('/vehiculos/estado', { method: 'POST', body: { id_vehiculo: id, id_comando: idComando, conectado: true }, ...opts }),
  iniciarDemo: (id, idDemo) => request(`/vehiculos/${id}/demo/iniciar`, { method: 'POST', body: { id_demo: idDemo } }),
  cancelarDemo: (id) => request(`/vehiculos/${id}/demo/cancelar`, { method: 'POST' }),
  salud: () => request(CONFIG.HEALTH_PATH, { timeout: CONFIG.HEALTH_TIMEOUT_MS }),
  saludBD: () => request(CONFIG.DB_HEALTH_PATH, { timeout: CONFIG.HEALTH_TIMEOUT_MS }),
  
  // Nuevos endpoints incorporados para la vista de Monitoreo
  obtenerUltimoEstado: (id) => request(`/vehiculos/${id}/estado`),
  obtenerHistorialUltimos10: (id) => request(`/vehiculos/${id}/historial/ultimos-10`),
};