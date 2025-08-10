import { BaseBrush } from './BaseBrush.js';
import { SoftBrush } from './SoftBrush.js';

export class EraserBrush extends BaseBrush {
  constructor(ctx, getBgColorFn) {
    super(ctx);
    this.getBgColor = getBgColorFn;
    this.soft = new SoftBrush(ctx);
  }
  
  setSize(size) { 
    super.setSize(size); 
    this.soft.setSize(size); 
  }
  
  setColor() {
    // ignore - eraser always uses background color
  }
  
  beginStroke(x, y) { 
    this.soft.setColor(this.getBgColor()); 
    this.soft.beginStroke(x, y); 
  }
  
  strokeTo(x0, y0, x1, y1) { 
    this.soft.setColor(this.getBgColor()); 
    this.soft.strokeTo(x0, y0, x1, y1); 
  }
  
  endStroke() {}
} 