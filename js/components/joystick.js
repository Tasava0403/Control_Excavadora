const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const OFFSET = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Joystick circular con Pointer Events (mouse + táctil + lápiz) y teclado.
// Emite onDirection(dir|null) solo cuando CAMBIA la dirección efectiva.
export class Joystick {
  #el; #knob; #id = null; #dir = null; #disabled = false;
  constructor(el, { deadzone = 0.35, onDirection }) {
    this.#el = el; this.dz = deadzone; this.onDirection = onDirection;
    el.innerHTML = ['up', 'down', 'left', 'right'].map((d) => `<i class="bi bi-caret-${d}-fill joystick__arrow" data-a="${d}" aria-hidden="true"></i>`).join('')
      + '<span class="joystick__center" aria-hidden="true"></span><span class="joystick__knob" aria-hidden="true"></span>';
    this.#knob = el.querySelector('.joystick__knob');
    el.dataset.dir = 'none';

    el.addEventListener('pointerdown', (e) => {
      if (this.#disabled || this.#id !== null) return;
      this.#id = e.pointerId; el.setPointerCapture(e.pointerId); el.classList.add('is-active'); e.preventDefault(); this.#move(e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === this.#id) this.#move(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) =>
      el.addEventListener(t, (e) => { if (e.pointerId === this.#id) this.#release(); }));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('keydown', (e) => {
      const d = KEYS[e.key]; if (!d || this.#disabled) return;
      e.preventDefault(); if (e.repeat) return;
      const R = el.getBoundingClientRect().width / 2;
      this.#knobTo(OFFSET[d][0] * R * 0.62, OFFSET[d][1] * R * 0.62); this.#setDir(d);
    });
    el.addEventListener('keyup', (e) => { if (KEYS[e.key] === this.#dir) this.#release(); });
    el.addEventListener('blur', () => this.#release());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.#release(); });
    window.addEventListener('blur', () => this.#release());
  }

  setDisabled(v) {
    if (v === this.#disabled) return;
    this.#disabled = v; this.#el.setAttribute('aria-disabled', String(v));
    if (v) this.#release();
  }

  #move(e) {
    const r = this.#el.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const len = Math.hypot(dx, dy), max = R * 0.62;
    if (len > max) { dx *= max / len; dy *= max / len; }
    this.#knobTo(dx, dy);
    if (len < R * this.dz) return this.#setDir(null);
    const ax = Math.abs(dx), ay = Math.abs(dy);
    // Histéresis: evita parpadeo entre ejes cerca de la diagonal.
    const horiz = this.#dir ? (this.#dir === 'left' || this.#dir === 'right' ? ax > ay * 0.8 : ax > ay * 1.25) : ax > ay;
    this.#setDir(horiz ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }

  #knobTo(x, y) { this.#knob.style.setProperty('--x', `${x}px`); this.#knob.style.setProperty('--y', `${y}px`); }
  #setDir(d) { if (d === this.#dir) return; this.#dir = d; this.#el.dataset.dir = d ?? 'none'; this.onDirection(d); }
  #release() { this.#id = null; this.#el.classList.remove('is-active'); this.#knobTo(0, 0); this.#setDir(null); }
}
