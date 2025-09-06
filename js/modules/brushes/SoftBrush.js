import { BaseBrush } from './BaseBrush.js';

export class SoftBrush extends BaseBrush {
  constructor(ctx) {
    super(ctx);
    this.stampCanvas = document.createElement('canvas');
    this.cachedColor = null;
    this.cachedSize = 0;
    this.spacingFactor = 0.25; // smaller = denser stamps, smoother result
  }
  
  rebuildStamp() {
    const r = this.size;
    if (!r) return;
    if (this.cachedColor === this.color && this.cachedSize === r) return;
    
    this.cachedColor = this.color;
    this.cachedSize = r;
    
    const { r: cr, g: cg, b: cb } = BaseBrush.hexToRgb(this.color);
    this.stampCanvas.width = r * 2;
    this.stampCanvas.height = r * 2;
    
    const bctx = this.stampCanvas.getContext('2d');
    const g = bctx.createRadialGradient(r, r, 0, r, r, r);
    // Smoother, softer falloff with more stops
    g.addColorStop(0.0, `rgba(${cr}, ${cg}, ${cb}, 1)`);
    g.addColorStop(0.25, `rgba(${cr}, ${cg}, ${cb}, 0.65)`);
    g.addColorStop(0.6, `rgba(${cr}, ${cg}, ${cb}, 0.25)`);
    g.addColorStop(1.0, `rgba(${cr}, ${cg}, ${cb}, 0)`);
    
    bctx.clearRect(0, 0, r * 2, r * 2);
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, r * 2, r * 2);
  }
  
  beginStroke(x, y) { 
    this.rebuildStamp(); 
    this.stampAt(x, y); 
  }
  
  stampAt(x, y) {
    const r = this.size;
    this.ctx.drawImage(this.stampCanvas, x - r, y - r);
  }
  
  strokeTo(x0, y0, x1, y1) {
    this.rebuildStamp();
    const dist = Math.hypot(x1 - x0, y1 - y0);
    // Denser spacing for smoother strokes; clamp to avoid excessive work
    const step = Math.max(0.35, this.size * this.spacingFactor);
    
    for (let d = 0; d <= dist; d += step) {
      const t = dist ? d / dist : 0;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      this.stampAt(x, y);
    }
  }
} 