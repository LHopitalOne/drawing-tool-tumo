import { hexToRgb } from '../utils.js';

// Base brush class that all brushes inherit from
export class BaseBrush {
  constructor(ctx) {
    this.ctx = ctx;
    this.size = 30;
    this.color = '#ffffff';
  }
  
  setSize(size) { 
    this.size = Math.max(1, size | 0); 
  }
  
  setColor(color) { 
    this.color = color || '#ffffff'; 
  }
  
  beginStroke(x, y) {}
  strokeTo(x0, y0, x1, y1) {}
  endStroke() {}
  
  // Utility method for converting hex colors to RGB (now imported from utils)
  static hexToRgb(hex) {
    return hexToRgb(hex);
  }
} 