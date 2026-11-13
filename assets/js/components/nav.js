import { $, $$ } from '../utils/dom.js';

// Navegación por hash simple (#control / #monitoreo): compatible con GitHub Pages.
// Las vistas siguen montadas (sin listeners duplicados); solo se muestran u ocultan.
export function initNav({ onEnter }) {
  const vistas = { control: $('#vista-control'), monitoreo: $('#vista-monitoreo') };
  const links = $$('[data-vista]');
  let actual = null;
  const ir = () => {
    const v = location.hash === '#monitoreo' ? 'monitoreo' : 'control';
    if (v === actual) return;
    actual = v;
    Object.entries(vistas).forEach(([k, el]) => { el.hidden = k !== v; });
    links.forEach((a) => (a.dataset.vista === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    document.title = `${v === 'monitoreo' ? 'Monitoreo' : 'Control'} · Excavadora IoT`;
    onEnter(v);
  };
  window.addEventListener('hashchange', ir);
  ir();
}
