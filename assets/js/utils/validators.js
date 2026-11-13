import { CONFIG } from '../config.js';
import { ApiError } from './errors.js';
import { parseFecha } from './fechas.js';

// Respuesta de GET /vehiculos/{id}/estado. Contrato real:
// { id_vehiculo, vehiculo, id_comando, comando, codigo, conectado, fecha_actualizacion }
// Sin estado previo la API responde { id_vehiculo, conectado:false, mensaje }.
export function validarEstado(r, idVehiculo) {
  if (!r || typeof r !== 'object') return { tipo: 'invalido' };
  if (r.id_vehiculo !== undefined && r.id_vehiculo !== idVehiculo) return { tipo: 'otro_vehiculo' };
  if (r.codigo === undefined && r.mensaje) return { tipo: 'sin_estado' };
  if (!Number.isInteger(r.codigo) || typeof r.comando !== 'string') return { tipo: 'invalido' };
  return { tipo: 'ok', estado: { codigo: r.codigo, comando: r.comando, fecha: parseFecha(r.fecha_actualizacion) } };
}

const pick = (row, claves) => claves.find((k) => row[k] !== undefined && row[k] !== null);

// Adaptador del historial: valida cada fila, ordena por ID real (o fecha) y limita a 10.
// Si el contrato no coincide NO inventa datos: lanza error (y registra en consola las claves recibidas).
export function normalizarHistorial(lista, idVehiculo, nombrePorCodigo = {}) {
  if (!Array.isArray(lista)) throw new ApiError('invalid', 'Historial no es una lista');
  const K = CONFIG.HISTORIAL_CLAVES, filas = [];
  lista.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    if (row.id_vehiculo !== undefined && row.id_vehiculo !== idVehiculo) return;
    const ki = pick(row, K.id), kf = pick(row, K.fecha), kc = pick(row, K.comando);
    const fecha = kf ? parseFecha(row[kf]) : null;
    const nombre = kc ? String(row[kc]) : (Number.isInteger(row.codigo) ? nombrePorCodigo[row.codigo] ?? null : null);
    if (!nombre || (!fecha && ki === undefined)) {
      console.warn('Historial: el contrato no coincide. Claves recibidas:', Object.keys(row));
      throw new ApiError('invalid', 'Contrato de historial no coincide');
    }
    filas.push({ id: ki ? row[ki] : null, nombre, fecha, orig: i });
  });

  const conId = filas.length > 0 && filas.every((f) => Number.isFinite(Number(f.id)) && f.id !== null);
  const orden = (a, b) => (conId ? Number(b.id) - Number(a.id)
    : (b.fecha?.ms ?? 0) - (a.fecha?.ms ?? 0) || a.orig - b.orig);
  const primera = filas[0]?.fecha?.ms, ultima = filas.at(-1)?.fecha?.ms;
  const ascendente = filas.length >= CONFIG.HISTORIAL_LIMIT && primera !== undefined && ultima !== undefined && primera < ultima;

  const vistos = new Map();
  const salida = filas.sort(orden).slice(0, CONFIG.HISTORIAL_LIMIT).map((f) => {
    const base = f.id !== null ? `id:${f.id}` : `${f.fecha?.texto}|${f.nombre}`;
    const n = (vistos.get(base) ?? 0) + 1; vistos.set(base, n);
    return { ...f, key: f.id !== null ? base : `${base}#${n}` };
  });
  return {
    filas: salida,
    aviso: ascendente ? 'La API devolvió el historial en orden ascendente: podrían no ser los 10 más recientes. Revisa el orden en el backend.' : null,
  };
}
