import { CONFIG } from '../config.js';
import { ApiError } from '../utils/errors.js';

// Cliente HTTP genérico: URL base, encabezados, timeout, JSON y errores tipificados.
export async function request(path, { method = 'GET', body, timeout = CONFIG.REQUEST_TIMEOUT_MS, signal } = {}) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeout);
  if (signal?.aborted) ctrl.abort();
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(CONFIG.API_BASE_URL + path, {
      method,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError('http', `HTTP ${res.status}`, { status: res.status });
    try { return await res.json(); }
    catch (e) { throw new ApiError('invalid', 'JSON inválido', { cause: e }); }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError(timedOut ? 'timeout' : 'aborted', 'Solicitud abortada');
    throw new ApiError('network', 'Error de red', { cause: e });
  } finally {
    clearTimeout(timer);
  }
}
