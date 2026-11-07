import { COMMANDS, CONFIG, LABELS } from '../config.js';
import { store } from '../state/store.js';
import { $, $$ } from '../utils/dom.js';

const STATUS = {
  ws: { en_linea: ['ok', 'En línea', 'bi-check-circle-fill'], conectando: ['wait', 'Conectando…', 'bi-arrow-repeat'],
        reconectando: ['wait', 'Reconectando…', 'bi-arrow-repeat'], desconectado: ['bad', 'Desconectado', 'bi-x-circle-fill'] },
  aws: { disponible: ['ok', 'Disponible', 'bi-check-circle-fill'], comprobando: ['wait', 'Comprobando…', 'bi-arrow-repeat'],
         no_disponible: ['bad', 'No disponible', 'bi-x-circle-fill'] },
  rds: { disponible: ['ok', 'Disponible', 'bi-check-circle-fill'], no_disponible: ['bad', 'No disponible', 'bi-x-circle-fill'],
         sin_verificar: ['unknown', 'Sin verificar', 'bi-question-circle-fill'] },
};
const STEP_ICON = { idle: 'bi-circle', wait: 'bi-hourglass-split', ok: 'bi-check-circle-fill', error: 'bi-x-circle-fill' };
const STEP_TXT = { idle: '', wait: '— pendiente', ok: '— confirmado', error: '— error' };
const BTN_TXT = { idle: '', enviando: 'Enviando…', aceptado: 'Aceptado', recibido: 'Recibido', error: 'Error' };
const DEMO_TXT = { inactiva: 'Sin DEMO en ejecución', iniciando: 'Iniciando DEMO…', cancelando: 'Cancelando DEMO…' };

export function initUI({ commands, demo, joysticks }) {
  $$('[data-cmd]').forEach((b) => b.addEventListener('click', () => commands.enviar(b.dataset.cmd)));
  $('#demo-iniciar').addEventListener('click', () => {
    const id = Number($('#demo-select').value);
    if (Number.isInteger(id) && id > 0) demo.iniciar(id);
  });
  $('#demo-cancelar').addEventListener('click', () => demo.cancelar().catch(() => {}));

  let prevDemos = null;
  const render = (s) => {
    $('#vehiculo-nombre').textContent = s.vehiculo.nombre ?? `Vehículo ${CONFIG.VEHICLE_ID}`;

    for (const k of ['ws', 'aws', 'rds']) {
      const [tone, text, icon] = STATUS[k][s[k]];
      const el = $(`#st-${k}`);
      el.dataset.tone = tone;
      $('.status__value', el).textContent = text;
      $('i', el).className = `bi ${icon}`;
    }

    const a = s.accion;
    $('#accion-texto').textContent = a ? `Última acción: ${LABELS[a.nombre] ?? a.nombre}` : 'Sin acciones todavía.';
    const st = { solicitado: a ? 'ok' : 'idle', aceptado: !a ? 'idle' : a.aceptado ? 'ok' : a.error ? 'error' : 'wait',
                 evento: !a ? 'idle' : a.evento ? 'ok' : a.error ? 'idle' : 'wait' };
    $$('.steps li').forEach((li) => {
      const v = st[li.dataset.step]; li.dataset.state = v;
      $('i', li).className = `bi ${STEP_ICON[v]}`; $('.visually-hidden', li).textContent = STEP_TXT[v];
    });
    const m = $('#mensaje'); m.textContent = s.mensaje?.texto ?? ''; m.dataset.level = s.mensaje?.nivel ?? 'info';

    const demoActiva = s.demo.estado !== 'inactiva';
    $$('[data-cmd]').forEach((b) => {
      const n = b.dataset.cmd;
      const v = a && a.nombre === n ? (a.error ? 'error' : a.evento ? 'recibido' : a.aceptado ? 'aceptado' : 'enviando') : 'idle';
      b.dataset.state = v; b.setAttribute('aria-busy', String(v === 'enviando'));
      $('.cmd__state', b).textContent = BTN_TXT[v];
      b.disabled = !s.comandos[n] || (n !== COMMANDS.STOP && demoActiva);
    });
    joysticks.forEach((j) => j.setDisabled(demoActiva || !Object.keys(s.comandos).length));

    const sel = $('#demo-select');
    if (s.demos !== prevDemos) {
      prevDemos = s.demos; const keep = sel.value; sel.replaceChildren();
      const ph = document.createElement('option');
      ph.value = ''; ph.textContent = s.demosEstado === 'error' ? 'No se pudieron cargar las DEMO' : s.demos.length ? 'Selecciona una DEMO…' : 'Sin DEMO disponibles';
      sel.append(ph);
      s.demos.forEach((d) => { const o = document.createElement('option'); o.value = String(d.id_demo); o.textContent = d.nombre; sel.append(o); });
      if (keep) sel.value = keep;
    }
    sel.disabled = demoActiva || !s.demos.length;
    $('#demo-iniciar').disabled = demoActiva || !sel.value;
    $('#demo-cancelar').disabled = !demoActiva;
    $('#demo-estado').textContent = s.demo.estado === 'ejecutando'
      ? `DEMO en ejecución · movimiento ${Math.min(s.demo.progreso, s.demo.total)} de ${s.demo.total}` : DEMO_TXT[s.demo.estado];
  };
  store.subscribe(render);
  $('#demo-select').addEventListener('change', () => render(store.get()));
}
