export default class DotField {
  constructor(options = {}) {
    this.numDots = Number.isFinite(options.numDots) ? options.numDots : 1400;
    this.dotColor = options.dotColor || 'rgb(110,110,110)';
    this.dotRadius = Number.isFinite(options.dotRadius) ? options.dotRadius : 1.1;
    this.repelRadius = Number.isFinite(options.repelRadius) ? options.repelRadius : 120;
    this.repelStrength = Number.isFinite(options.repelStrength) ? options.repelStrength : 0.08;
    this.restoringStrength = Number.isFinite(options.restoringStrength) ? options.restoringStrength : 0.03;
    this.friction = Number.isFinite(options.friction) ? options.friction : 0.9;
    this.backgroundColor = typeof options.backgroundColor === 'string' ? options.backgroundColor : '';
    this.colorFn = typeof options.colorFn === 'function' ? options.colorFn : null;
    this.radiusFn = typeof options.radiusFn === 'function' ? options.radiusFn : null;
    
    // Allow custom positioning strategy
    this.positioning = options.positioning || 'fixed'; // 'fixed' or 'absolute'
    this.customHeight = options.customHeight || null; // e.g., '10vh', '100px'
    this.customTop = options.customTop || null; // e.g., '100vh', '0'
    
    // Option to use reference dimensions for consistent spacing
    this.useReferenceAspect = options.useReferenceAspect || null; // e.g., 1.0 for square
    this.referenceCellSize = options.referenceCellSize || null; // Fixed cell size in px

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.position = this.positioning;
    this.canvas.style.left = '0';
    this.canvas.style.top = this.customTop || '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = this.customHeight || '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '0';

    this.dots = [];
    this.mouseX = -1e6;
    this.mouseY = -1e6;
    this._raf = 0;
    this._dpr = 1; // DPR used for sizing/transform; keep consistent between frames
    this._onResize = this._onResize.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._tick = this._tick.bind(this);
  }

  mount() {
    document.body.appendChild(this.canvas);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('mousemove', this._onMouseMove, { passive: true });
    this._onResize();
    this._raf = requestAnimationFrame(this._tick);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousemove', this._onMouseMove);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }

  _onResize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    // Use actual rendered canvas size (getBoundingClientRect accounts for CSS sizing)
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this._dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._layoutDots(w, h);
  }

  _layoutDots(w, h) {
    // Even grid distribution
    const total = this.numDots;
    
    let cellW, cellH, cols, rows;
    
    if (this.referenceCellSize !== null) {
      // Use fixed cell size for consistent spacing
      cellW = this.referenceCellSize;
      cellH = this.referenceCellSize;
      cols = Math.max(1, Math.floor(w / cellW));
      rows = Math.max(1, Math.ceil(total / cols));
    } else {
      // Use reference aspect ratio if provided, otherwise use actual canvas aspect
      const aspect = this.useReferenceAspect !== null ? this.useReferenceAspect : (w / h);
      cols = Math.max(10, Math.round(Math.sqrt(total * aspect)));
      rows = Math.max(10, Math.round(total / cols));
      cellW = w / cols;
      cellH = h / rows;
    }

    const dots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (dots.length >= total) break;
        const x = (c + 0.5) * cellW;
        const y = (r + 0.5) * cellH;
        dots.push({
          x, y,
          ox: x, oy: y, // original positions
          vx: 0, vy: 0,
        });
      }
    }
    this.dots = dots;
  }

  _onMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  _tick() {
    const ctx = this.ctx;
    // If browser zoom changed (DPR changed) without a resize event, update backing store
    const currentDpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    if (Math.abs(currentDpr - this._dpr) > 0.001) {
      // Keep layout based on current viewport size
      this._onResize();
    }

    const w = this.canvas.width / this._dpr;
    const h = this.canvas.height / this._dpr;
    // Clear and paint background (if configured)
    ctx.clearRect(0, 0, w, h);
    if (this.backgroundColor) {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    const repelR2 = this.repelRadius * this.repelRadius;
    // Convert mouse position from viewport coordinates to canvas-local coordinates
    const rect = this.canvas.getBoundingClientRect();
    const mx = this.mouseX - rect.left;
    const my = this.mouseY - rect.top;

    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];

      // Repel from mouse
      const dx = d.x - mx;
      const dy = d.y - my;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < repelR2) {
        const dist = Math.max(0.0001, Math.sqrt(dist2));
        const force = (1 - dist / this.repelRadius) * this.repelStrength;
        const nx = dx / dist;
        const ny = dy / dist;
        d.vx += nx * force * this.repelRadius;
        d.vy += ny * force * this.repelRadius;
      }

      // Restore to original position
      const rx = d.ox - d.x;
      const ry = d.oy - d.y;
      d.vx += rx * this.restoringStrength;
      d.vy += ry * this.restoringStrength;

      // Integrate velocity with friction
      d.vx *= this.friction;
      d.vy *= this.friction;
      d.x += d.vx;
      d.y += d.vy;

      // Draw
      let radius = this.dotRadius;
      if (this.radiusFn) {
        const customRadius = this.radiusFn({ x: d.x, y: d.y, ox: d.ox, oy: d.oy, index: i, width: w, height: h });
        if (Number.isFinite(customRadius) && customRadius >= 0) radius = customRadius;
      }
      
      // Skip drawing if radius is effectively 0
      if (radius < 0.01) continue;
      
      ctx.beginPath();
      ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
      if (this.colorFn) {
        const col = this.colorFn({ x: d.x, y: d.y, ox: d.ox, oy: d.oy, index: i, width: w, height: h });
        if (typeof col === 'string' && col) ctx.fillStyle = col; else ctx.fillStyle = this.dotColor;
      } else {
        ctx.fillStyle = this.dotColor;
      }
      ctx.fill();
    }

    this._raf = requestAnimationFrame(this._tick);
  }
}


