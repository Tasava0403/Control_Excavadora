// Conexión WSS propia del navegador. Solo informa el estado de ESTE socket,
// nunca la presencia del vehículo físico.
function parse(data) {
  const t = String(data).trim();
  if (t.startsWith('{')) { try { return { tipo: 'json', data: JSON.parse(t) }; } catch { /* sigue */ } }
  if (/^-?\d+$/.test(t)) return { tipo: 'codigo', codigo: Number(t) };
  return { tipo: 'desconocido' };
}

export class VehicleSocket {
  #ws = null; #timer = null; #attempt = 0;
  constructor(url, { onStatus, onMessage, backoff }) {
    this.url = url; this.onStatus = onStatus; this.onMessage = onMessage; this.backoff = backoff;
  }

  connect() {
    window.addEventListener('online', () => { if (this.#ws?.readyState !== WebSocket.OPEN) this.#open(); });
    this.#open();
  }

  #open() {
    clearTimeout(this.#timer);
    if (this.#ws && this.#ws.readyState <= WebSocket.OPEN) { this.#ws.onclose = null; this.#ws.close(); }
    this.onStatus(this.#attempt > 0 ? 'reconectando' : 'conectando');
    let ws;
    try { ws = new WebSocket(this.url); } catch { this.#schedule(); return; }
    this.#ws = ws;
    ws.onopen = () => { this.#attempt = 0; this.onStatus('en_linea'); };
    ws.onmessage = (e) => this.onMessage(parse(e.data));
    ws.onerror = () => { if (this.#ws === ws) this.onStatus('desconectado'); };
    ws.onclose = () => { if (this.#ws !== ws) return; this.onStatus('desconectado'); this.#schedule(); };
  }

  #schedule() {
    const { min, max } = this.backoff;
    const delay = Math.min(max, min * 2 ** this.#attempt++) * (0.75 + Math.random() * 0.5);
    this.#timer = setTimeout(() => this.#open(), delay);
  }
}
