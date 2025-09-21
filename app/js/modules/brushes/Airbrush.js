import { BaseBrush } from './BaseBrush.js';

export class Airbrush extends BaseBrush {
  beginStroke() {}
  
  strokeTo(x0, y0, x1, y1) {
    const ctx = this.ctx;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(dist / (this.size * 0.5)));
    
    for (let i = 0; i < steps; i++) {
      const t = steps ? i / steps : 0;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      this.sprayAt(ctx, x, y);
    }
  }
  
  sprayAt(ctx, x, y) {
    const radius = this.size;
    const density = Math.max(8, Math.floor(radius * 1.2));
    
    ctx.save();
    ctx.fillStyle = this.color;
    
    for (let i = 0; i < density; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const dx = Math.cos(ang) * r;
      const dy = Math.sin(ang) * r;
      const dotR = Math.random() * (radius * 0.08) + 0.4;
      
      ctx.globalAlpha = 0.12 + Math.random() * 0.15;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
} 