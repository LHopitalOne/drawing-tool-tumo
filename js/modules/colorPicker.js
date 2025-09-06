import { hexToRgb } from './utils.js';
import { rgbToHex, hsvToRgb, rgbToHsv, clamp } from './utils.js';

export class ColorPickerModal {
  constructor(options) {
    const {
      anchorEl,
      initialHex = '#ffffff',
      onChange = () => {},
      onClose = () => {},
    } = options || {};
    this.anchorEl = anchorEl;
    this.onChange = onChange;
    this.onClose = onClose;

    const { r, g, b } = hexToRgb(initialHex);
    const { h, s, v } = rgbToHsv(r, g, b);
    this.hue = h;         // 0..360
    this.saturation = s;  // 0..1
    this.value = v;       // 0..1

    this.nodes = {};
    this._build();
    this._layout();
    this._renderPhyllotaxis();
    this._wireEvents();
  }

  _build() {
    const wrap = document.createElement('div');
    wrap.className = 'color-picker';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');

    const inner = document.createElement('div');
    inner.className = 'cp-inner';

    const left = document.createElement('div');
    left.className = 'cp-left';
    const field = document.createElement('div');
    field.className = 'cp-field';
    left.appendChild(field);

    const right = document.createElement('div');
    right.className = 'cp-right';

    const satWrap = document.createElement('div');
    satWrap.className = 'cp-slider-wrap';
    const satTri = document.createElement('div');
    satTri.className = 'cp-triangle cp-sat-grad';
    const sat = document.createElement('input');
    sat.type = 'range';
    sat.min = '0'; sat.max = '100'; sat.step = '1';
    sat.value = String(Math.round(this.saturation * 100));
    sat.className = 'cp-slider';
    const satMarks = document.createElement('div');
    satMarks.className = 'cp-slider-marks';
    for (let i = 0; i < 5; i++) {
      const m = document.createElement('span');
      m.className = 'cp-mark';
      satMarks.appendChild(m);
    }
    satWrap.appendChild(satTri);
    satWrap.appendChild(sat);
    satWrap.appendChild(satMarks);

    const valWrap = document.createElement('div');
    valWrap.className = 'cp-slider-wrap';
    const valTri = document.createElement('div');
    valTri.className = 'cp-triangle cp-val-grad';
    const val = document.createElement('input');
    val.type = 'range';
    val.min = '0'; val.max = '100'; val.step = '1';
    val.value = String(Math.round(this.value * 100));
    val.className = 'cp-slider';
    const valMarks = document.createElement('div');
    valMarks.className = 'cp-slider-marks';
    for (let i = 0; i < 5; i++) {
      const m = document.createElement('span');
      m.className = 'cp-mark';
      valMarks.appendChild(m);
    }
    valWrap.appendChild(valTri);
    valWrap.appendChild(val);
    valWrap.appendChild(valMarks);

    const hexWrap = document.createElement('div');
    hexWrap.className = 'cp-hex-wrap';
    const hexLabel = document.createElement('label');
    hexLabel.textContent = '#';
    hexLabel.setAttribute('for', 'cp-hex-input');
    const hexInput = document.createElement('input');
    hexInput.id = 'cp-hex-input';
    hexInput.type = 'text';
    hexInput.inputMode = 'text';
    hexInput.autocomplete = 'off';
    hexInput.value = rgbToHex(...hsvToRgb(this.hue, this.saturation, this.value));
    hexWrap.appendChild(hexLabel);
    hexWrap.appendChild(hexInput);

    const swatches = document.createElement('div');
    swatches.className = 'cp-swatches';
    const pref = ['#ffffff','#000000','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#808080','#ffa500'];
    pref.forEach((hex) => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'cp-swatch';
      s.style.background = hex;
      s.setAttribute('data-hex', hex);
      swatches.appendChild(s);
    });

    right.appendChild(satWrap);
    right.appendChild(valWrap);
    right.appendChild(hexWrap);
    right.appendChild(swatches);

    inner.appendChild(left);
    inner.appendChild(right);
    wrap.appendChild(inner);

    document.body.appendChild(wrap);

    this.nodes.wrap = wrap;
    this.nodes.field = field;
    this.nodes.sat = sat;
    this.nodes.val = val;
    this.nodes.satTri = satTri;
    this.nodes.valTri = valTri;
    this.nodes.hexInput = hexInput;
    this.nodes.swatches = swatches;
  }

  _layout() {
    const rect = this.anchorEl.getBoundingClientRect();
    const pad = 8;
    const top = rect.bottom + pad + window.scrollY;
    let left = rect.left + window.scrollX;
    // Prevent overflow to the right
    const w = 360;
    if (left + w > window.scrollX + window.innerWidth - 8) left = window.scrollX + window.innerWidth - 8 - w;
    if (left < 8) left = 8;
    this.nodes.wrap.style.top = `${top}px`;
    this.nodes.wrap.style.left = `${left}px`;
  }

  _renderPhyllotaxis() {
    const field = this.nodes.field;
    field.innerHTML = '';
    const W = field.clientWidth || 240;
    const H = field.clientHeight || 240;
    const cx = W / 2, cy = H / 2;
    const N = 270;
    const golden = Math.PI * (3 - Math.sqrt(5)); // ~2.399963...
    // const golden = (1 + Math.sqrt(5)) / 2; // ~1.618033988749895
    // Compute max radius to fill container
    const maxR = Math.min(cx, cy) - 6;
    const c = maxR / Math.sqrt(N);
    const s = this.saturation, v = this.value;

    for (let i = 0; i < N; i++) {
      const theta = i * golden;
      const r = c * Math.sqrt(i);
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'cp-dot';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      // smaller near center
      // Use a non-linear scaling (quadratic) to make size increase more rapidly near the edge
      const size = 0.618 * (4 + Math.pow(r / maxR, 2) * 9); // 4..13px, but grows faster near edge
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      // hue from angle (0..360)
      let hue = (theta * 180 / Math.PI) % 360;
      if (hue < 0) hue += 360;
      dot.dataset.hue = String(hue);
      const [dr, dg, db] = hsvToRgb(hue, s, v);
      dot.style.background = `rgb(${dr}, ${dg}, ${db})`;
      field.appendChild(dot);
    }
    this._highlightNearest();
    this._updateGradients();
  }

  _updatePhyllotaxisColors() {
    const field = this.nodes.field;
    const s = this.saturation, v = this.value;
    const dots = field.querySelectorAll('.cp-dot');
    dots.forEach((dot) => {
      const hue = Number(dot.dataset.hue) || 0;
      const [dr, dg, db] = hsvToRgb(hue, s, v);
      dot.style.background = `rgb(${dr}, ${dg}, ${db})`;
    });
    this._updateGradients();
  }

  _updateGradients() {
    // Update triangle gradients for current hue
    const [r1, g1, b1] = hsvToRgb(this.hue, 0, this.value); // low sat
    const [r2, g2, b2] = hsvToRgb(this.hue, 1, this.value); // high sat
    this.nodes.satTri.style.background = `linear-gradient(to bottom, rgb(${r1},${g1},${b1}), rgb(${r2},${g2},${b2}))`;
    const [r3, g3, b3] = hsvToRgb(this.hue, this.saturation, 0); // low val
    const [r4, g4, b4] = hsvToRgb(this.hue, this.saturation, 1); // high val
    this.nodes.valTri.style.background = `linear-gradient(to bottom, rgb(${r3},${g3},${b3}), rgb(${r4},${g4},${b4}))`;
  }

  _highlightNearest() {
    // Find dot whose hue is closest to current hue
    const dots = this.nodes.field.querySelectorAll('.cp-dot');
    let best = null, bestDiff = Infinity;
    dots.forEach((dot) => {
      const h = Number(dot.dataset.hue) || 0;
      let d = Math.abs(h - this.hue);
      if (d > 180) d = 360 - d;
      if (d < bestDiff) { best = dot; bestDiff = d; }
    });
    dots.forEach((dot) => dot.classList.remove('cp-dot-selected'));
    if (best) best.classList.add('cp-dot-selected');
  }

  _wireEvents() {
    const onPointerDownOutside = (e) => {
      if (!this.nodes.wrap.contains(e.target) && e.target !== this.anchorEl) {
        this.destroy();
      }
    };
    this._outsideHandler = onPointerDownOutside;
    setTimeout(() => document.addEventListener('mousedown', onPointerDownOutside), 0);
    document.addEventListener('keydown', (this._escHandler = (e) => { if (e.key === 'Escape') this.destroy(); }));

    this.nodes.field.addEventListener('click', (e) => {
      const dot = e.target.closest('.cp-dot');
      if (!dot) return;
      this.hue = Number(dot.dataset.hue) || 0;
      this._highlightNearest();
      this._updateGradients();
      const hex = rgbToHex(...hsvToRgb(this.hue, this.saturation, this.value));
      this.nodes.hexInput.value = hex;
      this.onChange(hex);
    });

    this.nodes.sat.addEventListener('input', () => {
      this.saturation = clamp(parseInt(this.nodes.sat.value, 10) / 100, 0, 1);
      this._updatePhyllotaxisColors();
      const hex = rgbToHex(...hsvToRgb(this.hue, this.saturation, this.value));
      this.nodes.hexInput.value = hex;
      this.onChange(hex);
    });
    this.nodes.val.addEventListener('input', () => {
      this.value = clamp(parseInt(this.nodes.val.value, 10) / 100, 0, 1);
      this._updatePhyllotaxisColors();
      const hex = rgbToHex(...hsvToRgb(this.hue, this.saturation, this.value));
      this.nodes.hexInput.value = hex;
      this.onChange(hex);
    });

    this.nodes.hexInput.addEventListener('input', () => {
      let hex = this.nodes.hexInput.value.trim();
      if (!hex.startsWith('#')) hex = `#${hex}`;
      if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(hex)) {
        const { r, g, b } = hexToRgb(hex);
        const { h, s, v } = rgbToHsv(r, g, b);
        this.hue = h; this.saturation = s; this.value = v;
        this.nodes.sat.value = String(Math.round(s * 100));
        this.nodes.val.value = String(Math.round(v * 100));
        this._updatePhyllotaxisColors();
        this._highlightNearest();
        this.onChange(hex);
      }
    });

    this.nodes.swatches.addEventListener('click', (e) => {
      const btn = e.target.closest('.cp-swatch');
      if (!btn) return;
      const hex = btn.getAttribute('data-hex');
      const { r, g, b } = hexToRgb(hex);
      const { h, s, v } = rgbToHsv(r, g, b);
      this.hue = h; this.saturation = s; this.value = v;
      this.nodes.sat.value = String(Math.round(s * 100));
      this.nodes.val.value = String(Math.round(v * 100));
      this.nodes.hexInput.value = hex;
      this._updatePhyllotaxisColors();
      this._highlightNearest();
      this.onChange(hex);
    });
  }

  destroy() {
    document.removeEventListener('mousedown', this._outsideHandler);
    document.removeEventListener('keydown', this._escHandler);
    this.nodes.wrap.remove();
    this.onClose();
  }
}

export default ColorPickerModal;


