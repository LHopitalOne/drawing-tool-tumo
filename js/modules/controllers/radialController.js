// RadialController manages the radial settings panel interactions and hover/focus visuals

export class RadialController {
  constructor() {
    this._isOpen = false;
    this._isRightMouseSelecting = false;
    this._isLongPressSelecting = false;
    this._currentHoverEl = null;
    this._docMouseMoveHandler = null;
    this._docTouchMoveHandler = null;
  }

  isOpen() { return this._isOpen; }
  isLongPressSelecting() { return this._isLongPressSelecting; }
  setLongPressSelecting(v) { this._isLongPressSelecting = Boolean(v); }

  openAt(clientX, clientY, { via = 'mouse' } = {}) {
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) return;
    settingsPanel.style.left = `${clientX}px`;
    settingsPanel.style.top = `${clientY}px`;
    settingsPanel.removeAttribute('hidden');
    this._isOpen = true;
    this._isRightMouseSelecting = (via === 'mouse' && typeof clientX === 'number');

    // Sync visuals with current active selection when opening
    if (window.brushRing && window.brushRing.setButtonVisuals) {
      // activeKey is managed by DrawingTool; we pass null hover
      const activeKey = (window.drawingTool && window.drawingTool.activeBrushKey) || null;
      window.brushRing.setButtonVisuals(activeKey, null);
    }

    // Track cursor/finger while open
    this._docMouseMoveHandler = (ev) => {
      if (!this._isOpen) return;
      if (typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
        this.updateHover(ev.clientX, ev.clientY);
      }
    };
    document.addEventListener('mousemove', this._docMouseMoveHandler);

    this._docTouchMoveHandler = (ev) => {
      if (!this._isOpen) return;
      if (ev.touches && ev.touches[0]) {
        this.updateHover(ev.touches[0].clientX, ev.touches[0].clientY);
      }
    };
    document.addEventListener('touchmove', this._docTouchMoveHandler, { passive: false });

    // Finalize on mouseup anywhere if opened via right click
    const onMouseUpOnce = (ev) => {
      const focusActive = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
      if (!focusActive) this.finalizeSelection(ev);
    };
    document.addEventListener('mouseup', onMouseUpOnce, { once: true });
  }

  close() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) settingsPanel.setAttribute('hidden', '');
    this._isOpen = false;
    this._isRightMouseSelecting = false;
    this._isLongPressSelecting = false;
    this._currentHoverEl = null;
    if (this._docMouseMoveHandler) {
      document.removeEventListener('mousemove', this._docMouseMoveHandler);
      this._docMouseMoveHandler = null;
    }
    if (this._docTouchMoveHandler) {
      document.removeEventListener('touchmove', this._docTouchMoveHandler);
      this._docTouchMoveHandler = null;
    }
  }

  updateHover(clientX, clientY) {
    const brushGroupEl = document.querySelector('.brush-group');
    if (!brushGroupEl) return;
    const btn = this._hitTestButton(clientX, clientY);
    if (!btn) {
      if (this._currentHoverEl) {
        this._currentHoverEl = null;
        const activeKey = (window.drawingTool && window.drawingTool.activeBrushKey) || null;
        if (window.brushRing && window.brushRing.setButtonVisuals) {
          window.brushRing.setButtonVisuals(activeKey, null);
        }
      }
      return;
    }
    if (this._currentHoverEl !== btn) {
      this._currentHoverEl = btn;
      const activeKey = (window.drawingTool && window.drawingTool.activeBrushKey) || null;
      if (window.brushRing && window.brushRing.setButtonVisuals) {
        window.brushRing.setButtonVisuals(activeKey, btn);
      }
    }
  }

  finalizeSelection(e) {
    const brushGroupEl = document.querySelector('.brush-group');
    if (!brushGroupEl) { this.close(); return; }
    let targetBtn = this._currentHoverEl;
    if (!targetBtn && e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      targetBtn = this._hitTestButton(e.clientX, e.clientY);
      if (targetBtn && !brushGroupEl.contains(targetBtn)) targetBtn = null;
    }
    if (targetBtn) {
      const key = targetBtn.getAttribute('data-brush') || 'soft';
      document.dispatchEvent(new CustomEvent('brush:select', { detail: { key } }));
      if (window.brushRing && window.brushRing.setButtonVisuals) {
        const activeKey = (window.drawingTool && window.drawingTool.activeBrushKey) || key;
        window.brushRing.setButtonVisuals(activeKey);
      }
    }
    this.close();
  }

  _hitTestButton(clientX, clientY) {
    const group = document.querySelector('.brush-group');
    if (!group) return null;
    const buttons = Array.from(group.querySelectorAll('.brush-btn'));
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const rect = btn.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return btn;
      }
    }
    return null;
  }
}


