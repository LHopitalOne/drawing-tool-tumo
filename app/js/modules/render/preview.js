// Brush preview rendering (hover circle)

export function renderBrushPreview(ctx, dpr, viewportCanvas, scale, offsetX, offsetY, lastPointerClientX, lastPointerClientY, radius) {
  const rect = viewportCanvas.getBoundingClientRect();
  const mx = lastPointerClientX - rect.left;
  const my = lastPointerClientY - rect.top;
  const worldX = (mx - offsetX) / scale;
  const worldY = (my - offsetY) / scale;

  ctx.save();
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
  ctx.beginPath();
  ctx.arc(worldX, worldY, Math.max(1, radius), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200,200,200,0.9)';
  ctx.lineWidth = 0.5 / dpr;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.stroke();
  ctx.restore();
}


