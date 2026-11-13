export function formatearFechaHora(isoString) {
  if (!isoString) return '—';
  try {
    const fecha = new Date(isoString);
    if (isNaN(fecha.getTime())) return isoString;
    return fecha.toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return isoString;
  }
}