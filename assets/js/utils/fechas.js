import { CONFIG } from '../config.js';

const RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const fmt = new Intl.DateTimeFormat('es-MX', {
  timeZone: CONFIG.DISPLAY_TZ, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

// Las fechas del backend llegan SIN zona horaria. Sin una zona documentada (SERVER_UTC_OFFSET)
// se muestran tal cual, sin convertir ni suponer la zona del navegador.
export function parseFecha(valor) {
  if (typeof valor !== 'string') return null;
  const m = RE.exec(valor.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, tz] = m;
  let off = tz ?? CONFIG.SERVER_UTC_OFFSET;
  if (off) {
    if (/^[+-]\d{4}$/.test(off)) off = `${off.slice(0, 3)}:${off.slice(3)}`;
    const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}${off}`);
    return Number.isNaN(t) ? null : { ms: t, texto: fmt.format(new Date(t)).replace(',', '') };
  }
  return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s), texto: `${d}/${mo}/${y} ${h}:${mi}:${s}` };
}

export const etiquetaZona = () => (CONFIG.SERVER_UTC_OFFSET
  ? `Hora en ${CONFIG.DISPLAY_TZ}`
  : 'Hora del servidor (la API no declara zona horaria)');