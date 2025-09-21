import { BaseBrush } from './BaseBrush.js';
import { SoftBrush } from './SoftBrush.js';

export class EraserBrush extends BaseBrush {
  constructor(ctx, getBgColorFn) {
    super(ctx);
    this.getBgColor = getBgColorFn; // kept for backwards compatibility; no longer used
    this.soft = new SoftBrush(ctx);
  }
  
  setSize(size) { 
    super.setSize(size); 
    this.soft.setSize(size); 
  }
  
  setColor() {}
  
  beginStroke(x, y) {
    // Erase to transparency using destination-out across the whole stroke
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.soft.setColor('#000000');
    this.soft.beginStroke(x, y);
  }
  
  strokeTo(x0, y0, x1, y1) {
    this.soft.setColor('#000000');
    this.soft.strokeTo(x0, y0, x1, y1);
  }
  
  endStroke() { 
    this.ctx.restore(); 
  }
} 