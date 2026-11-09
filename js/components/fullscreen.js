import { notificar } from '../state/store.js';

// Botón de pantalla completa. Usa la Fullscreen API cuando existe (Android, escritorio, iPad).
// En iPhone/Safari no está disponible: se indica cómo instalar la página en la pantalla de inicio.
export function initFullscreen(btn) {
  const root = document.documentElement;
  const enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  const actual = () => document.fullscreenElement || document.webkitFullscreenElement;
  const instalada = matchMedia('(display-mode: fullscreen)').matches
    || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  if (instalada) { btn.hidden = true; return; } // ya se ve a pantalla completa

  const pintar = () => {
    const activa = Boolean(actual());
    btn.setAttribute('aria-pressed', String(activa));
    const txt = activa ? 'Salir de pantalla completa' : 'Pantalla completa';
    btn.setAttribute('aria-label', txt); btn.title = txt;
    btn.querySelector('i').className = `bi ${activa ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`;
  };

  btn.addEventListener('click', async () => {
    if (!enabled) {
      return notificar('En iPhone: Compartir → «Agregar a pantalla de inicio» y ábrela desde ahí.');
    }
    try {
      if (actual()) await (document.exitFullscreen?.() ?? document.webkitExitFullscreen());
      else await (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen());
    } catch { notificar('Tu navegador no permitió la pantalla completa.', 'error'); }
  });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((t) => document.addEventListener(t, pintar));
  pintar();
}
