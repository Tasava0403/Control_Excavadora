export class ApiError extends Error {
  constructor(kind, message, { status, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind; // timeout | network | http | invalid | aborted
    this.status = status;
    this.cause = cause;
  }
}

// Mensajes genéricos: nunca se muestra detalle interno del servidor.
export function mensajeUsuario(err) {
  switch (err?.kind) {
    case 'timeout': return 'La API tardó demasiado en responder.';
    case 'network': return 'No se pudo contactar con el servidor.';
    case 'http': return `El servidor rechazó la solicitud (HTTP ${err.status}).`;
    case 'invalid': return 'Respuesta no válida del servidor.';
    case 'aborted': return 'Solicitud cancelada.';
    default: return 'Ocurrió un error inesperado.';
  }
}
