export default class DotField {
  constructor(options = {}) {
    this.numDots = Number.isFinite(options.numDots) ? options.numDots : 1400;
    this.dotColor = options.dotColor || 'rgb(110,110,110)';
    this.dotRadius = Number.isFinite(options.dotRadius) ? options.dotRadius : 1.1;
    this.repelRadius = Number.isFinite(options.repelRadius) ? options.repelRadius : 120;
    this.repelStrength = Number.isFinite(options.repelStrength) ? options.repelStrength : 0.08;
    this.restoringStrength = Number.isFinite(options.restoringStrength) ? options.restoringStrength : 0.03;
    this.friction = Number.isFinite(options.friction) ? options.friction : 0.9;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.position = 'fixed';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '0';

    this.dots = [];
    this.mouseX = -1e6;
    this.mouseY = -1e6;
    this._raf = 0;
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
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._layoutDots(w, h);
  }

  _layoutDots(w, h) {
    // Even grid distribution
    const total = this.numDots;
    const aspect = w / h;
    const cols = Math.max(10, Math.round(Math.sqrt(total * aspect)));
    const rows = Math.max(10, Math.round(total / cols));
    const cellW = w / cols;
    const cellH = h / rows;

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
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.dotColor;

    const repelR2 = this.repelRadius * this.repelRadius;
    const mx = this.mouseX;
    const my = this.mouseY;

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
      ctx.beginPath();
      ctx.arc(d.x, d.y, this.dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    this._raf = requestAnimationFrame(this._tick);
  }
}


