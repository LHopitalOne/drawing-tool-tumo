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
    // Overlay for mobile
    const overlay = document.createElement('div');
    overlay.className = 'cp-overlay cp-enter';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);

    const wrap = document.createElement('div');
    wrap.className = 'color-picker cp-enter';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');

    // Header with close
    const header = document.createElement('div');
    header.className = 'cp-header';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cp-close';
    closeBtn.setAttribute('aria-label', 'Close');
    // Use an SVG for the close icon instead of text
    closeBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <line x1="5" y1="5" x2="15" y2="15" stroke="rgb(128, 128, 128)" stroke-width="2" stroke-linecap="round"/>
        <line x1="15" y1="5" x2="5" y2="15" stroke="rgb(128, 128, 128)" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    header.appendChild(closeBtn);

    const inner = document.createElement('div');
    inner.className = 'cp-inner';

    const left = document.createElement('div');
    left.className = 'cp-top';
    const field = document.createElement('div');
    field.className = 'cp-field';
    left.appendChild(field);

    const right = document.createElement('div');
    right.className = 'cp-bottom';

    const satWrap = document.createElement('div');
    satWrap.className = 'cp-slider-wrap';
    const satTri = document.createElement('div');
    satTri.className = 'cp-triangle cp-sat-grad';
    // Custom overlay slider
    const satRail = document.createElement('div'); satRail.className = 'cp-slider-rail';
    const satHandle = document.createElement('div'); satHandle.className = 'cp-slider-handle';
    const satMarks = document.createElement('div');
    satMarks.className = 'cp-slider-marks';
    for (let i = 0; i < 5; i++) {
      const m = document.createElement('span');
      m.className = 'cp-mark';
      satMarks.appendChild(m);
    }
    satWrap.appendChild(satTri);
    satWrap.appendChild(satRail);
    satWrap.appendChild(satHandle);
    satWrap.appendChild(satMarks);

    const valWrap = document.createElement('div');
    valWrap.className = 'cp-slider-wrap';
    const valTri = document.createElement('div');
    valTri.className = 'cp-triangle cp-val-grad';
    // Custom overlay slider
    const valRail = document.createElement('div'); valRail.className = 'cp-slider-rail';
    const valHandle = document.createElement('div'); valHandle.className = 'cp-slider-handle';
    const valMarks = document.createElement('div');
    valMarks.className = 'cp-slider-marks';
    for (let i = 0; i < 5; i++) {
      const m = document.createElement('span');
      m.className = 'cp-mark';
      valMarks.appendChild(m);
    }
    valWrap.appendChild(valTri);
    valWrap.appendChild(valRail);
    valWrap.appendChild(valHandle);
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
    wrap.appendChild(header);
    wrap.appendChild(inner);

    document.body.appendChild(wrap);
    // Stage enter animation
    requestAnimationFrame(() => {
      overlay.classList.remove('cp-enter');
      overlay.classList.add('cp-open');
      wrap.classList.remove('cp-enter');
      wrap.classList.add('cp-open');
    });

    this.nodes.overlay = overlay;
    this.nodes.wrap = wrap;
    this.nodes.header = header;
    this.nodes.closeBtn = closeBtn;
    this.nodes.field = field;
    this.nodes.satRail = satRail; this.nodes.satHandle = satHandle;
    this.nodes.valRail = valRail; this.nodes.valHandle = valHandle;
    this.nodes.satTri = satTri;
    this.nodes.valTri = valTri;
    this.nodes.hexInput = hexInput;
    this.nodes.swatches = swatches;
  }

  _layout() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      this.nodes.overlay.style.display = 'block';
      this.nodes.wrap.classList.add('cp-mobile');
      // Centered by CSS left/top in class
    } else {
      this.nodes.wrap.classList.add('cp-desktop');
      const rect = this.anchorEl.getBoundingClientRect();
      const pad = 8;
      const top = rect.bottom + pad + window.scrollY;
      let left = rect.left + window.scrollX;
      const w = this.nodes.wrap.getBoundingClientRect().width || 500;
      if (left + w > window.scrollX + window.innerWidth - 8) left = window.scrollX + window.innerWidth - 8 - w;
      if (left < 8) left = 8;
      this.nodes.wrap.style.top = `${top}px`;
      this.nodes.wrap.style.left = `${left}px`;
    }
  }

  _renderPhyllotaxis() {
    const field = this.nodes.field;
    field.innerHTML = '';
    const W = field.clientWidth || 240;
    const H = field.clientHeight || 240;
    const cx = W / 2, cy = H / 2;
    const N = 360;
    const golden = Math.PI * (3 - Math.sqrt(5)); // ~2.399963...
    // const golden = (1 + Math.sqrt(5)) / 2; // ~1.618033988749895
    // Compute max radius to fill container
    const maxR = Math.min(cx, cy) - 6;
    const c = maxR / Math.sqrt(N);
    const s = this.saturation, v = this.value;
    // Define concentric rings for staged animation
    const numRings = 12;
    const ringWidth = maxR / numRings;

    for (let i = 0; i < N; i++) {
      const theta = i * golden;
      const r = c * Math.sqrt(i);
      const targetX = cx + r * Math.cos(theta);
      const targetY = cy + r * Math.sin(theta);
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'cp-dot';
      // Start at center; we'll translate outward
      dot.style.left = `${cx}px`;
      dot.style.top = `${cy}px`;
      // smaller near center
      // Use a non-linear scaling (quadratic) to make size increase more rapidly near the edge
      const size =  (4 + Math.pow(r / maxR, 2) * 9); // 4..13px, but grows faster near edge
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      // hue from angle (0..360)
      let hue = (theta * 180 / Math.PI) % 360;
      if (hue < 0) hue += 360;
      dot.dataset.hue = String(hue);
      const [dr, dg, db] = hsvToRgb(hue, s, v);
      dot.style.background = `rgb(${dr}, ${dg}, ${db})`;
      // Precompute outward movement delta and a small rotation
      const dx = targetX - cx;
      const dy = targetY - cy;
      dot.dataset.dx = String(dx);
      dot.dataset.dy = String(dy);
      // Ring index for staging
      const ringIndex = Math.max(0, Math.min(numRings - 1, Math.floor(r / ringWidth)));
      dot.dataset.ring = String(ringIndex);
      // Initial transform: centered, underscaled, no rotation
      dot.style.transform = `translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(0.7)`;
      field.appendChild(dot);
    }
    this._highlightNearest();
    this._updateGradients();
    // Position handles according to current values
    this._positionHandles();
    // Kick off enter growth animation staggered by radius
    requestAnimationFrame(() => {
      // Start the dot growth slightly after the modal appears
      const startDelayMs = 160;
      setTimeout(() => {
        const dots = Array.from(field.querySelectorAll('.cp-dot'));
        const ringDelayMs = 70;
        // Determine max ring so we can animate from outer to inner
        let maxRing = 0;
        dots.forEach((d) => { const r = parseInt(d.dataset.ring || '0', 10) || 0; if (r > maxRing) maxRing = r; });
        dots.forEach((dot) => {
          const ringIndex = parseInt(dot.dataset.ring || '0', 10) || 0;
          const jitter = Math.random() * 10; // subtle within-ring variation
          const delay = (maxRing - ringIndex) * ringDelayMs + jitter;
          setTimeout(() => {
            const dx = parseFloat(dot.dataset.dx || '0') || 0;
            const dy = parseFloat(dot.dataset.dy || '0') || 0;
            dot.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(20deg) scale(1)`;
          }, delay);
        });
        // Apply a slight overall rotation to enhance growth feel
        // try {
        //   this.nodes.field.style.transform = 'rotate(3deg)';
        //   setTimeout(() => { this.nodes.field.style.transform = 'rotate(0deg)'; }, ringDelayMs * 12 + 120);
        // } catch (_) {}
      }, startDelayMs);
    });
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
    this._positionHandles();
  }

  _positionHandles() {
    // map sat/value 0..1 to percentage on rail
    if (this.nodes.satHandle && this.nodes.satRail) {
      const pct = this.saturation * 100;
      this.nodes.satHandle.style.left = `${pct}%`;
    }
    if (this.nodes.valHandle && this.nodes.valRail) {
      const pct = this.value * 100;
      this.nodes.valHandle.style.left = `${pct}%`;
    }
  }

  _updateGradients() {
    // Update triangle gradients for current hue
    const [r1, g1, b1] = hsvToRgb(this.hue, 0, this.value); // low sat
    const [r2, g2, b2] = hsvToRgb(this.hue, 1, this.value); // high sat
    this.nodes.satTri.style.background = `linear-gradient(to right, rgb(${r1},${g1},${b1}), rgb(${r2},${g2},${b2}))`;
    const [r3, g3, b3] = hsvToRgb(this.hue, this.saturation, 0); // low val
    const [r4, g4, b4] = hsvToRgb(this.hue, this.saturation, 1); // high val
    this.nodes.valTri.style.background = `linear-gradient(to right, rgb(${r3},${g3},${b3}), rgb(${r4},${g4},${b4}))`;
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
    // Close button
    this.nodes.closeBtn.addEventListener('click', () => this.destroy());

    // Draggable on desktop
    if (this.nodes.wrap.classList.contains('cp-desktop')) {
      let dragging = false;
      let sx = 0, sy = 0; let sox = 0, soy = 0;
      const onDown = (e) => {
        dragging = true; this.nodes.header.classList.add('dragging');
        sx = e.clientX; sy = e.clientY;
        const r = this.nodes.wrap.getBoundingClientRect();
        sox = r.left; soy = r.top;
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx; const dy = e.clientY - sy;
        const nx = sox + dx; const ny = soy + dy;
        this.nodes.wrap.style.left = `${nx}px`;
        this.nodes.wrap.style.top = `${ny}px`;
      };
      const onUp = () => { dragging = false; this.nodes.header.classList.remove('dragging'); };
      this.nodes.header.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', (this._dragMove = onMove));
      window.addEventListener('mouseup', (this._dragUp = onUp));
    }
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

    // Remove native input listeners (not used)
    // Custom sat drag
    const satDrag = (clientX) => {
      const r = this.nodes.satRail.getBoundingClientRect();
      const pct = clamp((clientX - r.left) / r.width, 0, 1);
      this.saturation = pct;
      this._updatePhyllotaxisColors();
      const hex = rgbToHex(...hsvToRgb(this.hue, this.saturation, this.value));
      this.nodes.hexInput.value = hex;
      this.onChange(hex);
    };
    let satDragging = false;
    this.nodes.satRail.addEventListener('mousedown', (e) => { satDragging = true; satDrag(e.clientX); e.preventDefault(); });
    this.nodes.satHandle.addEventListener('mousedown', (e) => { satDragging = true; satDrag(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => { if (satDragging) { satDrag(e.clientX); e.preventDefault(); } });
    window.addEventListener('mouseup', () => { satDragging = false; });
    // Remove native input listeners (not used)
    // Custom val drag
    const valDrag = (clientX) => {
      const r = this.nodes.valRail.getBoundingClientRect();
      const pct = clamp((clientX - r.left) / r.width, 0, 1);
      this.value = pct;
      this._updatePhyllotaxisColors();
      const hex = rgbToHex(...hsvToRgb(this.hue, this.saturation, this.value));
      this.nodes.hexInput.value = hex;
      this.onChange(hex);
    };
    let valDragging = false;
    this.nodes.valRail.addEventListener('mousedown', (e) => { valDragging = true; valDrag(e.clientX); e.preventDefault(); });
    this.nodes.valHandle.addEventListener('mousedown', (e) => { valDragging = true; valDrag(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => { if (valDragging) { valDrag(e.clientX); e.preventDefault(); } });
    window.addEventListener('mouseup', () => { valDragging = false; });

    this.nodes.hexInput.addEventListener('input', () => {
      let hex = this.nodes.hexInput.value.trim();
      if (!hex.startsWith('#')) hex = `#${hex}`;
      if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(hex)) {
        const { r, g, b } = hexToRgb(hex);
        const { h, s, v } = rgbToHsv(r, g, b);
        this.hue = h; this.saturation = s; this.value = v;
        this._updatePhyllotaxisColors();
        this._positionHandles();
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
      this.nodes.hexInput.value = hex;
      this._updatePhyllotaxisColors();
      this._positionHandles();
      this._highlightNearest();
      this.onChange(hex);
    });
  }

  destroy() {
    document.removeEventListener('mousedown', this._outsideHandler);
    document.removeEventListener('keydown', this._escHandler);
    if (this._dragMove) window.removeEventListener('mousemove', this._dragMove);
    if (this._dragUp) window.removeEventListener('mouseup', this._dragUp);

    const overlay = this.nodes.overlay;
    const wrap = this.nodes.wrap;
    if (!wrap) return;
    // Animate out the phyllotaxis dots collapsing back to center
    try {
      const field = this.nodes.field;
      const dots = Array.from(field.querySelectorAll('.cp-dot'));
      // Determine max ring among dots
      let maxRing = 0;
      dots.forEach((d) => { const r = parseInt(d.dataset.ring || '0', 10) || 0; if (r > maxRing) maxRing = r; });
      const ringDelayMs = 36;
      dots.forEach((dot) => {
        const ringIndex = parseInt(dot.dataset.ring || '0', 10) || 0;
        const reverseIndex = maxRing - ringIndex;
        const jitter = Math.random() * 8;
        const delay = reverseIndex * ringDelayMs + jitter;
        setTimeout(() => {
          dot.style.transform = 'translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(0.7)';
        }, delay);
      });
      // Slight opposite rotation on close
      try {
        field.style.transform = 'rotate(-6deg)';
      } catch (_) {}
    } catch (_) {}

    // Animate container out
    overlay && overlay.classList.remove('cp-open');
    wrap.classList.remove('cp-open');
    overlay && overlay.classList.add('cp-exit');
    wrap.classList.add('cp-exit');

    const cleanup = () => {
      overlay && overlay.remove();
      wrap.remove();
      this.onClose();
    };
    wrap.addEventListener('transitionend', cleanup, { once: true });
    // Fallback in case transitionend doesn't fire
    this._closeTimer = setTimeout(cleanup, 280);
  }
}

export default ColorPickerModal;


