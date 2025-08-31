import { BaseBrush } from './BaseBrush.js';

export class PenBrush extends BaseBrush {
  beginStroke() {}
  
  strokeTo(x0, y0, x1, y1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.size * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  getPreviewRadius() {
    return this.size; // approximate handle size for preview
  }
} 