import { BaseBrush } from './BaseBrush.js';

export class FountainPen extends BaseBrush {
  constructor(ctx) {
    super(ctx);
    this.lastX = 0;
    this.lastY = 0;
    this.lastTime = 0;
    this.currentRadius = this.size;
    this.minRadius = this.size * 0.01;
    this.maxRadius = this.size;
    this.speedSensitivity = 0.05; // How much speed affects thickness
    this.smoothing = 0.7; // Smoothing factor for radius changes
  }

  beginStroke(x, y) {
    this.lastX = x;
    this.lastY = y;
    this.lastTime = performance.now();
    this.currentRadius = this.minRadius; // Start with thin stroke
    
    // Draw initial circle
    this.drawCircle(x, y, this.currentRadius);
  }
  
  strokeTo(x0, y0, x1, y1) {
    const currentTime = performance.now();
    const timeDelta = Math.max(1, currentTime - this.lastTime);
    const distance = Math.hypot(x1 - x0, y1 - y0);
    
    // Calculate speed (pixels per millisecond)
    const speed = distance / timeDelta;
    
    // Map speed to radius (faster = thinner, slower = thicker)
    const targetRadius = this.calculateRadiusFromSpeed(speed);
    
    // Smooth radius transitions
    this.currentRadius = this.lerp(this.currentRadius, targetRadius, 1 - this.smoothing);
    
    // Draw smooth stroke with circles
    this.drawSmoothStroke(x0, y0, x1, y1, this.currentRadius);
    
    // Update tracking variables
    this.lastX = x1;
    this.lastY = y1;
    this.lastTime = currentTime;
  }
  
  calculateRadiusFromSpeed(speed) {
    // Speed threshold values (adjust these for sensitivity)
    const slowSpeed = 0.1;   // Below this = max thickness
    const fastSpeed = 2.0;   // Above this = min thickness
    
    // Clamp speed to our range
    const clampedSpeed = Math.max(slowSpeed, Math.min(fastSpeed, speed));
    
    // Invert the relationship: higher speed = smaller radius
    const speedFactor = 1 - ((clampedSpeed - slowSpeed) / (fastSpeed - slowSpeed));
    
    // Apply easing curve for more natural feel
    const easedFactor = this.easeInOut(speedFactor);
    
    // Map to radius range
    return this.minRadius + (this.maxRadius - this.minRadius) * easedFactor;
  }
  
  easeInOut(t) {
    // Smooth easing function for more natural radius transitions
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  
  lerp(a, b, t) {
    // Linear interpolation for smooth transitions
    return a + (b - a) * t;
  }
  
  drawSmoothStroke(x0, y0, x1, y1, radius) {
    const distance = Math.hypot(x1 - x0, y1 - y0);
    
    if (distance < 0.5) {
      // Very short distance, just draw a circle
      this.drawCircle(x1, y1, radius);
      return;
    }
    
    // Calculate step size based on radius for smooth overlapping
    const step = Math.max(0.5, radius * 0.3);
    const steps = Math.ceil(distance / step);
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      
      // Slight radius variation for more organic feel
      const radiusVariation = 1 + Math.sin(t * Math.PI * 4) * 0.02;
      const circleRadius = radius * radiusVariation;
      
      this.drawCircle(x, y, circleRadius);
    }
  }
  
  drawCircle(x, y, radius) {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.85; // Slight transparency for better blending
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  // Update size-dependent properties when brush size changes
  setSize(size) {
    super.setSize(size);
    this.minRadius = this.size * 0.2;
    this.maxRadius = this.size * 0.8;
  }
} 