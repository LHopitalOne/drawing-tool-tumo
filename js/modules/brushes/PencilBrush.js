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

    const canvasSize = Math.ceil(radius * 2.6);
    this.stampCanvas.width = canvasSize;
    this.stampCanvas.height = canvasSize;
    const stampCtx = this.stampCanvas.getContext('2d');

    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const { r: red, g: green, b: blue } = hexToRgb(this.color);

    // Generate completely random noise for each stroke
    this.generateRandomTexture(stampCtx, centerX, centerY, radius, red, green, blue);
  }

  generateRandomTexture(ctx, centerX, centerY, radius, r, g, b) {
    const intensity = 0.36;   // Decreased by 60% from 0.9
    
    // Generate completely random noise for each stroke
    for (let y = 0; y < radius * 2; y++) {
      for (let x = 0; x < radius * 2; x++) {
        const dx = x - radius;
        const dy = y - radius;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= radius) {
          // Completely random noise value for each pixel
          const noiseValue = Math.random();
          
          // Create distance-based falloff
          const falloff = Math.max(0, 1 - (distance / radius));
          const edgeSoftness = 0.2; // Sharper edge
          const edgeFactor = Math.min(1, falloff / edgeSoftness);
          
          // Calculate alpha based on random noise and distance
          const alpha = noiseValue * intensity * edgeFactor;
          
          if (alpha > 0.02) { // Only draw if visible enough
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fillRect(x, y, 1, 1);
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