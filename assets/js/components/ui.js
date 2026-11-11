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
// Estado de cada botón: icono en una esquina (nunca solo color) + nombre accesible.
const BADGE = { enviando: 'bi-hourglass-split', aceptado: 'bi-check2', recibido: 'bi-check2-all', error: 'bi-exclamation-triangle-fill',
                activa: 'bi-play-fill' };
const BTN_TXT = { enviando: 'enviando', aceptado: 'aceptado por la API', recibido: 'evento recibido', error: 'error', activa: 'en curso' };
const TOGGLE = {
  CONTROL_LED: { txt: ['apagado', 'encendido'], icon: ['bi-lightbulb', 'bi-lightbulb-fill'] },
  CONTROL_SONIDO: { txt: ['desactivado', 'activado'], icon: ['bi-volume-mute-fill', 'bi-volume-up-fill'] },
};
const DEMO_TXT = { inactiva: 'Sin DEMO en ejecución', iniciando: 'Iniciando DEMO…', cancelando: 'Cancelando DEMO…' };

const marcar = (b, estado, base) => {
  b.dataset.state = estado; b.setAttribute('aria-busy', String(estado === 'enviando'));
  $('.cmd__badge', b).className = `cmd__badge bi ${BADGE[estado] ?? ''}`;
  b.setAttribute('aria-label', BTN_TXT[estado] ? `${base} — ${BTN_TXT[estado]}` : base);
};

export function initUI({ commands, demo, joysticks }) {
  const dlg = $('#demo-dialog');
  $$('[data-cmd]').forEach((b) => b.addEventListener('click', () => commands.enviar(b.dataset.cmd)));
  $('#btn-demo').addEventListener('click', () => dlg.showModal());
  $('#demo-cerrar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // clic en el fondo
  $('#demo-iniciar').addEventListener('click', () => {
    const id = Number($('#demo-select').value);
    if (Number.isInteger(id) && id > 0) { dlg.close(); demo.iniciar(id); }
  });
  $('#demo-cancelar').addEventListener('click', () => { dlg.close(); demo.cancelar().catch(() => {}); });

  let prevDemos = null, prevMsg = null, toastTimer = null;
  const render = (s) => {
    $('#vehiculo-nombre').textContent = s.vehiculo.nombre ?? `Vehículo ${CONFIG.VEHICLE_ID}`;

    for (const k of ['ws', 'aws', 'rds']) {
      const [tone, text, icon] = STATUS[k][s[k]];
      const el = $(`#st-${k}`);
      el.dataset.tone = tone;
      $('.status__value', el).textContent = text;
      $('i', el).className = `bi ${icon}`;
    }

    if (s.mensaje && s.mensaje !== prevMsg) {
      prevMsg = s.mensaje;
      const t = $('#toast'); t.textContent = s.mensaje.texto; t.dataset.level = s.mensaje.nivel;
      t.classList.add('is-visible'); clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('is-visible'), 4500);
    }

    const a = s.accion, demoActiva = s.demo.estado !== 'inactiva';
    $$('[data-cmd]').forEach((b) => {
      const n = b.dataset.cmd;
      const v = a && a.nombre === n ? (a.error ? 'error' : a.evento ? 'recibido' : a.aceptado ? 'aceptado' : 'enviando') : 'idle';
      let base = LABELS[n] ?? n;
      const tg = TOGGLE[n];
      if (tg) { // interruptor: icono y texto distintos, no solo color
        const on = Boolean(s.toggles[n]);
        base += ` ${tg.txt[on ? 1 : 0]} (estimado)`;
        b.setAttribute('aria-pressed', String(on));
        $('i', b).className = `bi ${tg.icon[on ? 1 : 0]}`;
      }
      marcar(b, v, base);
      b.disabled = !s.comandos[n] || (n !== COMMANDS.STOP && demoActiva);
    });
    marcar($('#btn-demo'), demoActiva ? 'activa' : 'idle', 'DEMO');
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
