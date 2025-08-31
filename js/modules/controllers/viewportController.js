// ViewportController: manages canvas view transform, pan, zoom, and pinch gestures

export class ViewportController {
  constructor(canvas) {
    this.canvas = canvas;
    this.scale = 1;
    this.fitScale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Pan state
    this.isPanning = false;
    this._panStartClientX = 0;
    this._panStartClientY = 0;
    this._panStartOffsetX = 0;
    this._panStartOffsetY = 0;

    // Pinch state
    this.isPinching = false;
    this._pinchStartDistance = 0;
    this._pinchStartScale = 1;
    this._pinchWorldMidX = 0;
    this._pinchWorldMidY = 0;
  }

  resizeBackingStore() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  fitToContent(contentWidth, contentHeight) {
    const rect = this.canvas.getBoundingClientRect();
    const vw = rect.width;
    const vh = rect.height;
    if (vw <= 0 || vh <= 0 || contentWidth <= 0 || contentHeight <= 0) return;
    this.fitScale = Math.min(vw / contentWidth, vh / contentHeight);
    this.scale = this.fitScale;
    this.offsetX = (vw - contentWidth * this.scale) / 2;
    this.offsetY = (vh - contentHeight * this.scale) / 2;
  }

  onResize(contentWidth, contentHeight) {
    const prevRect = this.canvas.getBoundingClientRect();
    const prevCenterScreen = { x: prevRect.width / 2, y: prevRect.height / 2 };
    const prevCenterWorld = {
      x: (prevCenterScreen.x - this.offsetX) / this.scale,
      y: (prevCenterScreen.y - this.offsetY) / this.scale,
    };
    const prevScale = this.scale;
    const prevFit = this.fitScale;

    this.resizeBackingStore();

    // Update fit scale with new viewport size
    const rect = this.canvas.getBoundingClientRect();
    const vw = rect.width;
    const vh = rect.height;
    if (vw > 0 && vh > 0 && contentWidth > 0 && contentHeight > 0) {
      this.fitScale = Math.min(vw / contentWidth, vh / contentHeight);
    }

    const userHadCustomZoom = Math.abs(prevScale - prevFit) > 1e-6;
    this.scale = userHadCustomZoom ? prevScale : this.fitScale;

    // Keep previous world center under the new screen center
    this.offsetX = rect.width / 2 - prevCenterWorld.x * this.scale;
    this.offsetY = rect.height / 2 - prevCenterWorld.y * this.scale;
  }

  wheel(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (e.ctrlKey) {
      e.preventDefault();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldXBefore = (mouseX - this.offsetX) / this.scale;
      const worldYBefore = (mouseY - this.offsetY) / this.scale;
      const zoomIntensity = 0.005;
      const factor = Math.exp(-e.deltaY * zoomIntensity);
      const minScale = Math.max(this.fitScale * 0.25, 0.05);
      const maxScale = 32;
      const newScale = Math.min(maxScale, Math.max(minScale, this.scale * factor));
      this.scale = newScale;
      this.offsetX = mouseX - worldXBefore * this.scale;
      this.offsetY = mouseY - worldYBefore * this.scale;
      return true;
    }
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 32 : (e.deltaMode === 2 ? rect.height : 1);
    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.shiftKey && Math.abs(dx) < 1 && Math.abs(dy) >= 1) {
      dx = dy; dy = 0;
    }
    const speed = 1.5;
    this.offsetX -= dx * unit * speed;
    this.offsetY -= dy * unit * speed;
    return true;
  }

  worldFromClient(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    return {
      x: (mx - this.offsetX) / this.scale,
      y: (my - this.offsetY) / this.scale,
    };
  }

  // Pinch helpers
  _getTouchesDistance(e) {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return Math.hypot(dx, dy);
  }

  _getTouchesMidpoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const mx = ((t0.clientX + t1.clientX) / 2) - rect.left;
    const my = ((t0.clientY + t1.clientY) / 2) - rect.top;
    return { mx, my };
  }

  beginPinch(e) {
    if (!e.touches || e.touches.length < 2) return;
    this.isPinching = true;
    this._pinchStartDistance = this._getTouchesDistance(e);
    this._pinchStartScale = this.scale;
    const { mx, my } = this._getTouchesMidpoint(e);
    this._pinchWorldMidX = (mx - this.offsetX) / this.scale;
    this._pinchWorldMidY = (my - this.offsetY) / this.scale;
  }

  updatePinch(e) {
    if (!this.isPinching || !e.touches || e.touches.length < 2) return;
    const currentDistance = this._getTouchesDistance(e);
    if (this._pinchStartDistance <= 0) return;
    const factor = currentDistance / this._pinchStartDistance;
    const minScale = Math.max(this.fitScale * 0.25, 0.05);
    const maxScale = 32;
    const newScale = Math.min(maxScale, Math.max(minScale, this._pinchStartScale * factor));
    const { mx, my } = this._getTouchesMidpoint(e);
    this.scale = newScale;
    this.offsetX = mx - this._pinchWorldMidX * this.scale;
    this.offsetY = my - this._pinchWorldMidY * this.scale;
  }

  endPinch() {
    this.isPinching = false;
  }

  // Pan helpers
  startPan(clientX, clientY) {
    this.isPanning = true;
    this._panStartClientX = clientX;
    this._panStartClientY = clientY;
    this._panStartOffsetX = this.offsetX;
    this._panStartOffsetY = this.offsetY;
  }

  updatePan(clientX, clientY) {
    if (!this.isPanning) return;
    const deltaX = clientX - this._panStartClientX;
    const deltaY = clientY - this._panStartClientY;
    this.offsetX = this._panStartOffsetX + deltaX;
    this.offsetY = this._panStartOffsetY + deltaY;
  }

  endPan() {
    this.isPanning = false;
  }
}


