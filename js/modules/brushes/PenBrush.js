import { BaseBrush } from './BaseBrush.js';

export class PenBrush extends BaseBrush {
  constructor(ctx) {
    super(ctx);
    this.points = [];
    this.sampleResolution = 0.3; // smaller = denser sampling along the curve
    this.symmetryStates = new Map(); // strokeId -> { points }
  }

  beginStroke(x, y, strokeId = null) {
    if (strokeId !== null) {
      this.symmetryStates.set(strokeId, { points: [{ x, y }] });
      this._drawDot(x, y);
      return;
    }
    this.points = [{ x, y }];
    this._drawDot(x, y);
  }
  
  strokeTo(x0, y0, x1, y1, strokeId = null) {
    if (strokeId !== null && this.symmetryStates.has(strokeId)) {
      const state = this.symmetryStates.get(strokeId);
      this._strokeWithSmoothing(state.points, x1, y1);
      return;
    }
    this._strokeWithSmoothing(this.points, x1, y1);
  }

  endStroke(strokeId = null) {
    if (strokeId !== null) {
      this.symmetryStates.delete(strokeId);
      return;
    }
    this.points = [];
  }

  _strokeWithSmoothing(points, x1, y1) {
    points.push({ x: x1, y: y1 });
    const n = points.length;
    if (n === 2) {
      this._drawInterpolatedLine(points[0], points[1]);
    } else if (n >= 3) {
      const p0 = points[n - 3];
      const p1 = points[n - 2];
      const p2 = points[n - 1];
      this._drawBezierSegment(p0, p1, p2);
    }
  }

  _drawDot(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawInterpolatedLine(p0, p1) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const stepLen = Math.max(0.25, this.size * this.sampleResolution);
    const steps = Math.max(1, Math.ceil(dist / stepLen));

    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.size * 2;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = p0.x + dx * t;
      const y = p0.y + dy * t;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawBezierSegment(p0, p1, p2) {
    const m1x = (p0.x + p1.x) * 0.5;
    const m1y = (p0.y + p1.y) * 0.5;
    const m2x = (p1.x + p2.x) * 0.5;
    const m2y = (p1.y + p2.y) * 0.5;

    const segDist = Math.hypot(m2x - m1x, m2y - m1y);
    const stepLen = Math.max(0.25, this.size * this.sampleResolution);
    const steps = Math.max(1, Math.ceil(segDist / stepLen));

    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.size * 2;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const omt = 1 - t;
      const x = omt * omt * m1x + 2 * omt * t * p1.x + t * t * m2x;
      const y = omt * omt * m1y + 2 * omt * t * p1.y + t * t * m2y;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  getPreviewRadius() {
    return this.size; // approximate handle size for preview
  }
}