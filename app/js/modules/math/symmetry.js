// Symmetry helpers used by DrawingTool

export function getCanvasCenter(canvas) {
  return { x: canvas.width / 2, y: canvas.height / 2 };
}

export function rotatePointAround(x, y, cx, cy, angleRad) {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cosA - dy * sinA, y: cy + dx * sinA + dy * cosA };
}

export function beginAndDot(brush, x, y, axes, centerX, centerY) {
  const count = axes | 0;
  if (!count) {
    brush.beginStroke(x, y);
    brush.strokeTo(x, y, x, y);
    return;
  }
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count;
    const p = rotatePointAround(x, y, centerX, centerY, angle);
    // Pass stroke ID for stateful brushes like FountainPen
    brush.beginStroke(p.x, p.y, i);
    brush.strokeTo(p.x, p.y, p.x, p.y, i);
  }
}

export function stroke(brush, x0, y0, x1, y1, axes, centerX, centerY) {
  const count = axes | 0;
  if (!count) {
    brush.strokeTo(x0, y0, x1, y1);
    return;
  }
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count;
    const p0 = rotatePointAround(x0, y0, centerX, centerY, angle);
    const p1 = rotatePointAround(x1, y1, centerX, centerY, angle);
    // Pass stroke ID for stateful brushes like FountainPen
    brush.strokeTo(p0.x, p0.y, p1.x, p1.y, i);
  }
}

export function endStroke(brush, axes) {
  const count = axes | 0;
  if (!count) {
    brush.endStroke();
    return;
  }
  for (let i = 0; i < count; i++) {
    // End each symmetry stroke
    brush.endStroke(i);
  }
}


