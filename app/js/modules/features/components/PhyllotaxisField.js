// Standalone phyllotaxis field animation, inspired by colorPicker's rendering
// Creates a container element with animated dots. Consumers can insert it anywhere.

import { hsvToRgb } from '../../utils.js';

export class PhyllotaxisField {
  constructor(options = {}) {
    const {
      width = 300,
      height = 300,
      saturation = 0.7,
      value = 1,
      className = '',
    } = options;

    this.width = width;
    this.height = height;
    this.saturation = saturation;
    this.value = value;

    const field = document.createElement('div');
    field.className = `phyllo-field ${className}`.trim();
    field.style.position = 'relative';
    // Allow CSS variables to control dimensions; fall back to provided defaults
    field.style.width = `var(--phyllo-width, ${width}px)`;
    field.style.height = `var(--phyllo-height, ${height}px)`;
    this.field = field;
  }

  render() {
    this._render();
  }

  el() {
    return this.field;
  }

  _render() {
    const field = this.field;
    field.innerHTML = '';
    // Measure from computed size so CSS variables (vw, %) are respected
    const rect = field.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width || this.width));
    const H = Math.max(1, Math.round(rect.height || this.height));
    const cx = W / 2, cy = H / 2;
    const N = 420;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const maxR = Math.min(cx, cy) - 10;
    const c = maxR / Math.sqrt(N);
    const s = this.saturation, v = this.value;
    const numRings = 12;
    const ringWidth = maxR / numRings;

    // Dot sizing from CSS variables
    const cs = getComputedStyle(field);
    const parsePx = (val, fallback) => {
      if (!val) return fallback;
      const n = parseFloat(val);
      return Number.isFinite(n) ? n : fallback;
    };
    const dotMin = parsePx(cs.getPropertyValue('--phyllo-dot-min-size'), 4);
    const dotMax = parsePx(cs.getPropertyValue('--phyllo-dot-max-size'), 14);

    for (let i = 0; i < N; i++) {
      const theta = i * golden;
      const r = c * Math.sqrt(i);
      const targetX = cx + r * Math.cos(theta);
      const targetY = cy + r * Math.sin(theta);
      const dot = document.createElement('div');
      dot.className = 'phyllo-dot';
      dot.style.position = 'absolute';
      dot.style.left = `${cx}px`;
      dot.style.top = `${cy}px`;
      const t = Math.pow(r / maxR, 2);
      const size = dotMin + t * (dotMax - dotMin);
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.borderRadius = '50%';
      dot.style.border = '0.5px solid rgba(255, 255, 255, 0.2)';
      dot.style.transform = `translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(0.8)`;
      let hue = (theta * 180 / Math.PI) % 360; if (hue < 0) hue += 360;
      const [dr, dg, db] = hsvToRgb(hue, s, v);
      dot.style.background = `rgb(${dr}, ${dg}, ${db})`;
      // data for animation
      const dx = targetX - cx;
      const dy = targetY - cy;
      dot.dataset.dx = String(dx);
      dot.dataset.dy = String(dy);
      const ringIndex = Math.max(0, Math.min(numRings - 1, Math.floor(r / ringWidth)));
      dot.dataset.ring = String(ringIndex);
      field.appendChild(dot);
    }

    requestAnimationFrame(() => {
      const dots = Array.from(field.querySelectorAll('.phyllo-dot'));
      const ringDelayMs = 70;
      let maxRing = 0;
      dots.forEach((d) => { const r = parseInt(d.dataset.ring || '0', 10) || 0; if (r > maxRing) maxRing = r; });
      dots.forEach((dot) => {
        const ringIndex = parseInt(dot.dataset.ring || '0', 10) || 0;
        const jitter = Math.random() * 12;
        const delay = (maxRing - ringIndex) * ringDelayMs + jitter + 160;
        setTimeout(() => {
          const dx = parseFloat(dot.dataset.dx || '0') || 0;
          const dy = parseFloat(dot.dataset.dy || '0') || 0;
          dot.style.transition = 'transform 0.6s cubic-bezier(0, 0, 0.2, 1)';
          dot.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(18deg) scale(1)`;
        }, delay);
      });
    });
  }
}

export default PhyllotaxisField;


