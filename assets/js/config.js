// Única fuente de configuración. Sin secretos: todo lo de aquí es público.
const HOST = 'vehiculos-aws-iot.duckdns.org';
const VEHICLE_ID = 1;

export const CONFIG = Object.freeze({
  API_BASE_URL: `https://${HOST}`,
  WSS_URL: `wss://${HOST}/ws/vehiculos/${VEHICLE_ID}`,
  VEHICLE_ID,
  HEALTH_PATH: '/status',        // operación de salud existente (GET)
  DB_HEALTH_PATH: '/salud/db',   // diagnóstico de BD expuesto por el backend (ver README)
  REQUEST_TIMEOUT_MS: 8000,
  HEALTH_TIMEOUT_MS: 5000,
  HEALTH_INTERVAL_MS: 20000,     // con API disponible
  HEALTH_RETRY_MS: 8000,         // recuperación tras fallo
  DB_INTERVAL_MS: 60000,
  WS_BACKOFF: { min: 1000, max: 15000 },
  JOYSTICK_DEADZONE: 0.35,
  PULSE_MS: 300,                 // tiempo en código 9/10 antes de volver a 11
  HISTORIAL_LIMIT: 10,
  SYNC_DEBOUNCE_MS: 250,         // agrupa ráfagas de eventos WSS en una sola consulta REST
  SYNC_RETRY_MS: 1200,           // única re-consulta si el historial aún no refleja el evento
  SERVER_UTC_OFFSET: null,       // p. ej. '+00:00' SOLO cuando se confirme la zona horaria del backend
  DISPLAY_TZ: 'America/Mexico_City',
  // Claves reales de cada fila de GET /vehiculos/{id}/historial/ultimos-10 (confirmadas con la API):
  // { id_historial, id_vehiculo, comando, codigo, fecha_hora, origen }
  HISTORIAL_CLAVES: { id: ['id_historial'], comando: ['comando'], fecha: ['fecha_hora'] },
});

export const COMMANDS = Object.freeze({ STOP: 'DETENER', LED: 'CONTROL_LED', SOUND: 'CONTROL_SONIDO' });
// Se activan con un pulso: código 9/10 un instante y luego regreso al estado 11.
export const TOGGLE_COMMANDS = Object.freeze([COMMANDS.LED, COMMANDS.SOUND]);
export const VEHICLE_DIRS = Object.freeze({ up: 'AVANZAR', down: 'RETROCEDER', left: 'GIRAR_IZQUIERDA', right: 'GIRAR_DERECHA' });
export const ARM_DIRS = Object.freeze({ up: 'SUBIR_BRAZO', down: 'BAJAR_BRAZO', left: 'GIRAR_I_PALA', right: 'GIRAR_D_PALA' });
export const LABELS = Object.freeze({
  AVANZAR: 'Avanzar', RETROCEDER: 'Retroceder', GIRAR_IZQUIERDA: 'Girar izquierda', GIRAR_DERECHA: 'Girar derecha',
  SUBIR_BRAZO: 'Subir brazo', BAJAR_BRAZO: 'Bajar brazo', GIRAR_I_PALA: 'Pala izquierda', GIRAR_D_PALA: 'Pala derecha',
  CONTROL_LED: 'LED', CONTROL_SONIDO: 'Sonido', DETENER: 'DETENER',
});
