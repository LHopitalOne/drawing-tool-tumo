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
    this.points = []; // Collected points for curve smoothing
    this.sampleResolution = 0.35; // Smaller = more stamps per pixel, smoother
    
    // Symmetry support: track multiple stroke states
    this.symmetryStates = new Map(); // key: strokeId, value: state object
    this.currentStrokeId = 0;
    this.isSymmetryMode = false;
  }

  beginStroke(x, y, strokeId = null) {
    // If strokeId is provided, we're in symmetry mode
    if (strokeId !== null) {
      this.isSymmetryMode = true;
      const state = {
        lastX: x,
        lastY: y,
        lastTime: performance.now(),
        currentRadius: this.minRadius,
        points: [{ x, y, r: this.minRadius }]
      };
      this.symmetryStates.set(strokeId, state);
      this.drawCircle(x, y, this.minRadius);
      return;
    }

    // Normal single stroke mode
    this.isSymmetryMode = false;
    this.symmetryStates.clear();
    this.lastX = x;
    this.lastY = y;
    this.lastTime = performance.now();
    this.currentRadius = this.minRadius; // Start with thin stroke
    this.points = [{ x, y, r: this.currentRadius }];

    // Draw initial circle
    this.drawCircle(x, y, this.currentRadius);
  }
  
  strokeTo(x0, y0, x1, y1, strokeId = null) {
    // If strokeId is provided, we're in symmetry mode - use separate state
    if (strokeId !== null && this.symmetryStates.has(strokeId)) {
      this._strokeToSymmetry(x0, y0, x1, y1, strokeId);
      return;
    }

    // Normal single stroke mode
    const currentTime = performance.now();
    const timeDelta = Math.max(1, currentTime - this.lastTime);
    const distance = Math.hypot(x1 - x0, y1 - y0);
    
    // Calculate speed (pixels per millisecond)
    const speed = distance / timeDelta;
    
    // Map speed to radius (faster = thinner, slower = thicker)
    const targetRadius = this.calculateRadiusFromSpeed(speed);
    
    // Smooth radius transitions
    this.currentRadius = this.lerp(this.currentRadius, targetRadius, 1 - this.smoothing);
    
    // Accumulate points for bezier smoothing
    const newPoint = { x: x1, y: y1, r: this.currentRadius };
    this.points.push(newPoint);

    const n = this.points.length;
    if (n === 2) {
      // First segment: draw simple interpolated line between first two points
      this._drawInterpolatedLine(this.points[0], this.points[1]);
    } else if (n >= 3) {
      // Draw a quadratic bezier between midpoints using the middle point as control
      const p0 = this.points[n - 3];
      const p1 = this.points[n - 2];
      const p2 = this.points[n - 1];
      this._drawBezierSegment(p0, p1, p2);
    }
    
    // Update tracking variables
    this.lastX = x1;
    this.lastY = y1;
    this.lastTime = currentTime;
  }

  _strokeToSymmetry(x0, y0, x1, y1, strokeId) {
    const state = this.symmetryStates.get(strokeId);
    const currentTime = performance.now();
    const timeDelta = Math.max(1, currentTime - state.lastTime);
    const distance = Math.hypot(x1 - x0, y1 - y0);
    
    // Calculate speed (pixels per millisecond)
    const speed = distance / timeDelta;
    
    // Map speed to radius (faster = thinner, slower = thicker)
    const targetRadius = this.calculateRadiusFromSpeed(speed);
    
    // Smooth radius transitions
    state.currentRadius = this.lerp(state.currentRadius, targetRadius, 1 - this.smoothing);
    
    // Accumulate points for bezier smoothing
    const newPoint = { x: x1, y: y1, r: state.currentRadius };
    state.points.push(newPoint);

    const n = state.points.length;
    if (n === 2) {
      // First segment: draw simple interpolated line between first two points
      this._drawInterpolatedLine(state.points[0], state.points[1]);
    } else if (n >= 3) {
      // Draw a quadratic bezier between midpoints using the middle point as control
      const p0 = state.points[n - 3];
      const p1 = state.points[n - 2];
      const p2 = state.points[n - 1];
      this._drawBezierSegment(p0, p1, p2);
    }
    
    // Update tracking variables in state
    state.lastX = x1;
    state.lastY = y1;
    state.lastTime = currentTime;
  }
  
  endStroke(strokeId = null) {
    if (strokeId !== null && this.symmetryStates.has(strokeId)) {
      // Clean up specific symmetry stroke
      this.symmetryStates.delete(strokeId);
      return;
    }
    
    // Normal single stroke mode - clean up
    this.points = [];
    this.symmetryStates.clear();
    this.isSymmetryMode = false;
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
  
  _drawInterpolatedLine(p0, p1) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) {
      this.drawCircle(p1.x, p1.y, p1.r);
      return;
    }
    const avgR = (p0.r + p1.r) * 0.5;
    const stepLen = Math.max(0.25, avgR * this.sampleResolution);
    const steps = Math.max(1, Math.ceil(dist / stepLen));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = p0.x + dx * t;
      const y = p0.y + dy * t;
      const r = this.lerp(p0.r, p1.r, t);
      this.drawCircle(x, y, r);
    }
  }

  _drawBezierSegment(p0, p1, p2) {
    // Quadratic bezier from midpoint(p0,p1) to midpoint(p1,p2) using p1 as control
    const m1x = (p0.x + p1.x) * 0.5;
    const m1y = (p0.y + p1.y) * 0.5;
    const m2x = (p1.x + p2.x) * 0.5;
    const m2y = (p1.y + p2.y) * 0.5;

    const segDist = Math.hypot(m2x - m1x, m2y - m1y);
    const avgR = (p0.r + p1.r + p2.r) / 3;
    const stepLen = Math.max(0.25, avgR * this.sampleResolution);
    const steps = Math.max(1, Math.ceil(segDist / stepLen));

    // Interpolate radius between mid-radii for stable thickness along curve
    const rStart = (p0.r + p1.r) * 0.5;
    const rEnd = (p1.r + p2.r) * 0.5;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const omt = 1 - t;
      const x = omt * omt * m1x + 2 * omt * t * p1.x + t * t * m2x;
      const y = omt * omt * m1y + 2 * omt * t * p1.y + t * t * m2y;
      const r = this.lerp(rStart, rEnd, t);
      this.drawCircle(x, y, r);
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