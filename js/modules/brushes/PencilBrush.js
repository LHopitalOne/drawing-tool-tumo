import { BaseBrush } from './BaseBrush.js';
import { hexToRgb, createSeededRandom } from '../utils.js';

export class PencilBrush extends BaseBrush {
  constructor(ctx) {
    super(ctx);
    this.stampCanvas = document.createElement('canvas');
    this.cachedColor = null;
    this.cachedSize = 0;
    this.rebuildStamp();
  }

  rebuildStamp() {
    const radius = this.size;
    if (!radius) return;
    if (this.cachedColor === this.color && this.cachedSize === radius) return;

    this.cachedColor = this.color;
    this.cachedSize = radius;

    // Allocate a bit larger than the drawn circle to avoid clipping soft edges
    const canvasSize = Math.ceil(radius * 2 + Math.max(4, radius * 0.6));
    this.stampCanvas.width = canvasSize;
    this.stampCanvas.height = canvasSize;
    const stampCtx = this.stampCanvas.getContext('2d');

    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const { r: red, g: green, b: blue } = hexToRgb(this.color);

    // Generate completely random noise for this stamp, centered in the canvas
    this.generateRandomTexture(stampCtx, centerX, centerY, radius, red, green, blue);
  }

  generateRandomTexture(ctx, centerX, centerY, radius, r, g, b) {
    const intensity = 0.36;   // Decreased by 60% from 0.9
    const edgeSoftness = 0.2; // Sharper edge
    // Clear any previous content on the stamp
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw noise centered at (centerX, centerY)
    const diameter = radius * 2;
    for (let y = 0; y < diameter; y++) {
      const dy = y - radius;
      const py = Math.floor(centerY + dy);
      for (let x = 0; x < diameter; x++) {
        const dx = x - radius;
        const px = Math.floor(centerX + dx);
        const distance = Math.hypot(dx, dy);
        if (distance <= radius) {
          const noiseValue = Math.random();
          const falloff = Math.max(0, 1 - (distance / radius));
          const edgeFactor = Math.min(1, falloff / edgeSoftness);
          const alpha = noiseValue * intensity * edgeFactor;
          if (alpha > 0.02) {
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  }

  beginStroke(x, y) {
    this.rebuildStamp();
    this.stampAt(x, y);
  }
  
  stampAt(x, y) {
    if (!this.stampCanvas || !this.stampCanvas.width) return;
    const halfW = this.stampCanvas.width / 2;
    const halfH = this.stampCanvas.height / 2;
    this.ctx.drawImage(this.stampCanvas, x - halfW, y - halfH);
  }

  strokeTo(x0, y0, x1, y1) {
    this.rebuildStamp();
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const step = this.size * 0.4; // Dense overlap for smooth texture

    for (let d = 0; d <= dist; d += step) {
      const t = dist ? d / dist : 0;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      this.stampAt(x, y);
    }
  }
} 