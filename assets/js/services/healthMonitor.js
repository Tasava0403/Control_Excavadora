import { CONFIG } from '../config.js';
import { vehicleApi } from './vehicleApi.js';

// Sondeo controlado y secuencial (nunca solapado). AWS = salud HTTPS de la API.
// RDS = solo lo que reporta el diagnóstico del backend; sin diagnóstico -> "sin_verificar".
export function startHealthMonitor({ onAws, onRds }) {
  const loop = (fn, okMs, failMs) => {
    const tick = async () => {
      let ok = false;
      if (!document.hidden) ok = await fn();
      setTimeout(tick, ok ? okMs : failMs);
    };
    tick();
  };

  loop(async () => {
    try { await vehicleApi.salud(); onAws('disponible'); return true; }
    catch { onAws('no_disponible'); return false; }
  }, CONFIG.HEALTH_INTERVAL_MS, CONFIG.HEALTH_RETRY_MS);

  loop(async () => {
    try {
      const r = await vehicleApi.saludBD();
      if (r?.base_datos === 'disponible') { onRds('disponible'); return true; }
      onRds('sin_verificar'); return false;
    } catch (e) {
      // 503 = el backend comprobó la BD y falló. Cualquier otra cosa no prueba nada sobre RDS.
      onRds(e.kind === 'http' && e.status === 503 ? 'no_disponible' : 'sin_verificar');
      return false;
    }
  }, CONFIG.DB_INTERVAL_MS, CONFIG.HEALTH_INTERVAL_MS);
}
