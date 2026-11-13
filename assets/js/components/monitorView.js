import { LABELS } from '../config.js';
import { store } from '../state/store.js';
import { monitor } from '../state/monitorStore.js';
import { etiquetaZona } from '../utils/fechas.js';
import { $ } from '../utils/dom.js';

const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
const ORIGEN = {
  rest: 'Leído de la API (base de datos).',
  wss: 'Evento recibido por WSS; confirmando con la API…',
  demo: 'Paso de DEMO en tiempo real; no se agrega al historial.',
};
const CHIP_ICON = { true: 'bi-check-circle-fill', false: 'bi-circle', na: 'bi-dash-circle' };
const chip = (id, v) => { const el = $(id); el.dataset.ok = String(v); $('i', el).className = `bi ${CHIP_ICON[v]}`; };

function crearFila(f) {
  const tr = document.createElement('tr'); tr.dataset.key = f.key;
  tr.append(document.createElement('th'), document.createElement('td'), document.createElement('td'));
  tr.firstChild.scope = 'row';
  return tr;
}

function renderFilas(tbody, filas) { // diff por clave: solo se tocan las celdas que cambian
  const previas = new Map([...tbody.children].map((tr) => [tr.dataset.key, tr]));
  filas.forEach((f, i) => {
    let tr = previas.get(f.key);
    if (tr) previas.delete(f.key); else tr = crearFila(f);
    const [c0, c1, c2] = tr.children;
    setText(c0, String(i + 1)); setText(c1, LABELS[f.nombre] ?? f.nombre); setText(c2, f.fecha?.texto ?? '—');
    if (tbody.children[i] !== tr) tbody.insertBefore(tr, tbody.children[i] ?? null);
  });
  previas.forEach((tr) => tr.remove());
}

export function initMonitorView() {
  let ws = store.get().ws;
  const render = () => {
    const m = monitor.get(), e = m.estado, d = e.datos;
    setText($('#mon-nombre'), d ? (LABELS[d.comando] ?? d.comando ?? `Código ${d.codigo}`)
      : { cargando: 'Cargando…', vacio: 'Sin movimientos', error: 'Error' }[e.fase] ?? '—');
    setText($('#mon-codigo'), d ? `Código ${d.codigo}` : '');
    setText($('#mon-fecha'), d ? (d.fecha ? d.fecha.texto : 'Obteniendo fecha del servidor…') : '');
    setText($('#mon-origen'), d ? (ORIGEN[e.origen] ?? '') : '');
    chip('#chip-wss', d && (e.origen === 'wss' || e.origen === 'demo'));
    chip('#chip-rest', d && e.origen === 'rest' ? true : false);
    chip('#chip-fisico', 'na');
    setText($('#mon-msg'), ws === 'desconectado' ? 'Desconectado: no se reciben eventos en tiempo real; se muestra la última consulta.'
      : e.fase === 'error' ? `Error: ${e.error ?? 'no se pudo consultar el último estado.'}` : '');

    const dm = m.demo, banner = $('#mon-demo');
    const txt = { ejecutando: `DEMO en curso · paso ${Math.min(dm.paso, dm.total)} de ${dm.total}`, finalizada: 'DEMO finalizada',
                  cancelada: 'DEMO cancelada', error: 'La DEMO reportó un error' }[dm.fase];
    banner.hidden = !txt; if (txt) setText(banner, `${txt} · estos pasos no se guardan en el historial individual.`);

    const h = m.historial;
    renderFilas($('#hist-body'), h.filas);
    setText($('#hist-msg'), h.fase === 'cargando' ? 'Cargando…' : h.fase === 'vacio' ? 'Sin movimientos registrados.'
      : h.fase === 'error' ? `Error: ${h.error}` : '');
    const av = $('#hist-aviso'); av.hidden = !h.aviso; if (h.aviso) setText(av, h.aviso);
    setText($('#hist-zona'), etiquetaZona());
  };
  monitor.subscribe(render);
  store.subscribe((s) => { if (s.ws !== ws) { ws = s.ws; render(); } });
}
