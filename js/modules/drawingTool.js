// Import brush classes from modules
import {
  SoftBrush,
  PenBrush,
  Airbrush,
  FountainPen,
  PencilBrush,
  EraserBrush
} from './brushes/index.js';
import { generateUUID as createUUID, hexToRgb } from './utils.js';

class DrawingTool {
  constructor() {
    // Viewport canvas (on-screen)
    this.viewportCanvas = document.getElementById('drawingCanvas');
    this.viewportCtx = this.viewportCanvas.getContext('2d');

    // Offscreen content canvas where drawing occurs in content coordinates
    this.contentCanvas = document.createElement('canvas');
    this.contentCtx = this.contentCanvas.getContext('2d');

    // Interaction state
    this.isDrawing = false;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.brushRadius = 30;
    this.brushColor = '#ffffff';

    // Background color (rendered behind content)
    this.backgroundColor = '#000000';
    // Tracks whether the content canvas has the background color baked into pixels
    // Older behavior painted background onto content; we convert on first change
    this._contentHasBakedBackground = true;

    // Symmetry
    this.symmetryAxes = 0; // 0 = off; N>0 draws N rotated copies around center

    // Active brush
    this.brushes = {};
    this.activeBrushKey = 'soft';
    // Per-brush settings
    this.brushSettings = {
      soft:   { size: this.brushRadius, color: this.brushColor },
      pen:    { size: this.brushRadius, color: this.brushColor },
      air:    { size: this.brushRadius, color: this.brushColor },
      fountain:{ size: this.brushRadius, color: this.brushColor },
      pencil: { size: this.brushRadius, color: this.brushColor },
      eraser: { size: this.brushRadius, color: this.brushColor },
    };

    // View transform (screen = world * scale + offset)
    this.scale = 1;
    this.fitScale = 1; // scale that fits content into viewport
    this.offsetX = 0;
    this.offsetY = 0;

    // Dragging state
    this.isSpacePressed = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartOffsetX = 0;
    this.dragStartOffsetY = 0;

    // Pinch zoom state
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.pinchStartScale = 1;
    this.pinchWorldMidX = 0;
    this.pinchWorldMidY = 0;

    // Touch gesture detection
    this.touchStartTime = 0;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isTouchGesture = false;

    // Radial (settings) selection state
    this.isRadialOpen = false;
    this.isRightMouseSelecting = false;
    this.currentRadialHoverEl = null;
    this.longPressTimeoutId = null;
    this.isLongPressSelecting = false;
    this._docMouseMoveHandler = null;
    this._docTouchMoveHandler = null;
    this._docMouseUpHandler = null;

    // Desktop hover preview state
    this._isPointerInCanvas = false;
    this._lastPointerClientX = 0;
    this._lastPointerClientY = 0;

    // Suppress next draw click after closing focus
    this._suppressNextMouseDown = false;

    // Bind resize handler
    this.handleResize = this.handleResize.bind(this);

    this.setupModal();

    // Expose for UI helpers
    try { window.drawingTool = this; } catch(_) {}
  }

  setupModal() {
    const modal = document.getElementById('setupModal');
    const form = document.getElementById('setupForm');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSetupSubmit();
    });
  }

  showError(message) {
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    const errorCloseBtn = document.getElementById('errorCloseBtn');
    errorMessage.textContent = message;
    errorModal.style.display = 'block';
    errorCloseBtn.onclick = () => {
      errorModal.style.display = 'none';
    };
  }

  handleSetupSubmit() {
    const widthInput = document.getElementById('canvasWidth');
    const heightInput = document.getElementById('canvasHeight');
    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);
    const mode = document.querySelector('input[name="mode"]:checked').value;

    const minW = parseInt(widthInput.min) || 1;
    const maxW = parseInt(widthInput.max) || 10000;
    const minH = parseInt(heightInput.min) || 1;
    const maxH = parseInt(heightInput.max) || 10000;

    if (Number.isNaN(width) || Number.isNaN(height)) {
      this.showError('Խնդրում եմ մուտքագրել թվային չափեր լայնության և բարձրության համար.');
      return;
    }
    if (width < minW || width > maxW || height < minH || height > maxH) {
      this.showError(`Չափերը սխալ են։ Լայնությունը պետք է լինի ${minW}–${maxW}, բարձրությունը՝ ${minH}–${maxH} պիքսել.`);
      return;
    }
    // Initialize content canvas at requested resolution
    this.contentCanvas.width = width;
    this.contentCanvas.height = height;


    document.getElementById('setupModal').style.display = 'none';
    document.body.classList.remove('modal-open');

    if (mode === 'draw') {
      this.init();
      this.setupEventListeners();
    } else {
      this.initForUpload();
      this.setupEventListeners();
      document.getElementById('fileInput').click();
    }
  }

  init() {
    // Initialize background and brush
    this.backgroundColor = document.getElementById('backgroundColor').value;
    // Keep content transparent; background is drawn during render
    this.contentCtx.clearRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    this.contentCtx.strokeStyle = this.brushColor;
    this.contentCtx.lineWidth = 1;
    this.contentCtx.lineCap = 'round';
    this.contentCtx.lineJoin = 'round';
    this.initializeBrushes();

    // New behavior: content has no baked background
    this._contentHasBakedBackground = false;

    // Prepare viewport and fit content
    this.resizeViewportCanvas();
    this.fitContentToViewport();
    this.render();
  }

  initForUpload() {
    this.backgroundColor = document.getElementById('backgroundColor').value;
    // Keep content transparent; background is drawn during render
    this.contentCtx.clearRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    this.contentCtx.strokeStyle = this.brushColor;
    this.contentCtx.lineWidth = 1;
    this.contentCtx.lineCap = 'round';
    this.contentCtx.lineJoin = 'round';
    this.initializeBrushes();

    this.resizeViewportCanvas();
    this.fitContentToViewport();
    this.render();
  }

  initializeBrushes() {
    // Build brushes bound to content context
    this.brushes = {
      soft: new SoftBrush(this.contentCtx),
      pen: new PenBrush(this.contentCtx),
      air: new Airbrush(this.contentCtx),
      fountain: new FountainPen(this.contentCtx),
      pencil: new PencilBrush(this.contentCtx),
      eraser: new EraserBrush(this.contentCtx, () => document.getElementById('backgroundColor').value),
    };
    // Sync base properties
    Object.entries(this.brushes).forEach(([key, b]) => {
      const s = this.brushSettings[key] || { size: this.brushRadius, color: this.brushColor };
      b.setSize(s.size);
      if (b.setColor) b.setColor(s.color);
    });
  }

  setupEventListeners() {
    // Pointer events
    this.viewportCanvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.viewportCanvas.addEventListener('mousemove', this.draw.bind(this));
    this.viewportCanvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.viewportCanvas.addEventListener('mouseout', this.stopDrawing.bind(this));
    this.viewportCanvas.addEventListener('touchstart', this.handleTouch.bind(this), { passive: false });
    this.viewportCanvas.addEventListener('touchmove', this.handleTouch.bind(this), { passive: false });
    this.viewportCanvas.addEventListener('touchend', this.stopDrawing.bind(this));

    // Prevent default context menu so right-click can be used for radial
    window.addEventListener('contextmenu', (e) => { e.preventDefault(); });

    // Wheel: handle desktop pinch-to-zoom (ctrlKey=true) only; normal wheel scroll passes through
    this.viewportCanvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

    // Keyboard events for spacebar dragging
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Controls
    document.getElementById('clearBtn').addEventListener('click', this.clearCanvas.bind(this));
    document.getElementById('saveBtn').addEventListener('click', this.saveImage.bind(this));
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    // Resize viewport when window resizes
    window.addEventListener('resize', this.handleResize);

    // Track pointer presence for desktop hover preview
    this.viewportCanvas.addEventListener('mouseenter', (e) => {
      this._isPointerInCanvas = true;
    });
    this.viewportCanvas.addEventListener('mouseleave', (e) => {
      this._isPointerInCanvas = false;
      this.render();
    });
    this.viewportCanvas.addEventListener('mousemove', (e) => {
      this._lastPointerClientX = e.clientX;
      this._lastPointerClientY = e.clientY;
      if (!this.isDrawing && !this.isRadialOpen) this.render();
    });

    // Listen to size changes from radial focus UI
    document.addEventListener('brush:size-change', (e) => {
      const current = this.getBrushSettings(this.activeBrushKey);
      const fallback = current ? current.size : 10;
      const val = Math.max(1, Math.min(400, e.detail && e.detail.size ? e.detail.size : fallback));
      this.brushSettings[this.activeBrushKey] = { ...current, size: val };
      this.getActiveBrush().setSize(val);
      // Sync size input if present
      const sizeInputEl = document.getElementById('brushSizeInput');
      if (sizeInputEl) sizeInputEl.value = String(val);
      this.render();
    });

    // Select brush from radial focus UI
    document.addEventListener('brush:select', (e) => {
      const key = e.detail && e.detail.key ? e.detail.key : null;
      if (!key) return;
      this.setActiveBrushByKey(key);
      if (window.brushRing && window.brushRing.setButtonVisuals) window.brushRing.setButtonVisuals(this.activeBrushKey);
    });

    // Reset pointer states when focus exits
    document.addEventListener('brush:focus-exit', () => {
      this.resetPointerStates();
      this.render();
    });

    // Clicking canvas exits focus mode if any
    this.viewportCanvas.addEventListener('mousedown', (ev) => {
      const focusActiveNow = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
      if (focusActiveNow) {
        ev.preventDefault();
        ev.stopPropagation();
        if (window.brushRing && window.brushRing.exitFocus) window.brushRing.exitFocus();
      }
    });

    // Floating settings UI
    const fabToggle = document.getElementById('fabToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const colorInput = document.getElementById('brushColorInput');
    const sizeInput = document.getElementById('brushSizeInput');
    const symmetryAxesInput = document.getElementById('symmetryAxesInput');
    const fitBtn = document.getElementById('fitViewBtn');
    const brushGroupEl = document.querySelector('.brush-group');

    // Floating button removed; open via right-click/long-press instead
    if (closeSettingsBtn && settingsPanel && fabToggle) {
      closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.setAttribute('hidden', '');
        fabToggle.setAttribute('aria-expanded', 'false');
      });
    }

    if (colorInput) {
      // Initialize color input with active brush color
      colorInput.value = this.getBrushSettings(this.activeBrushKey).color;
      colorInput.addEventListener('input', (e) => {
        const newColor = e.target.value || '#ffffff';
        // Update only active brush color
        this.brushSettings[this.activeBrushKey] = {
          ...this.getBrushSettings(this.activeBrushKey),
          color: newColor,
        };
        const activeBrush = this.getActiveBrush();
        if (activeBrush.setColor) activeBrush.setColor(newColor);
        // Update focus color dot if open
        if (window.brushRing && window.brushRing.updateFocusColor) {
          window.brushRing.updateFocusColor(newColor);
        }
      });
    }
    if (sizeInput) {
      sizeInput.value = String(this.getBrushSettings(this.activeBrushKey).size);
      sizeInput.addEventListener('input', (e) => {
        const val = Math.max(1, Math.min(400, parseInt(e.target.value || '1', 10)));
        // Update only active brush size
        this.brushSettings[this.activeBrushKey] = {
          ...this.getBrushSettings(this.activeBrushKey),
          size: val,
        };
        const activeBrush = this.getActiveBrush();
        activeBrush.setSize(val);
        this.render();
      });
    }
    if (symmetryAxesInput) {
      symmetryAxesInput.value = String(this.symmetryAxes);
      symmetryAxesInput.addEventListener('input', (e) => {
        const val = Math.max(0, Math.min(64, parseInt(e.target.value || '0', 10)));
        this.symmetryAxes = val | 0;
      });
    }
    
    // Canvas background color control
    const canvasBgColorInput = document.getElementById('canvasBackgroundColor');
    if (canvasBgColorInput) {
      // Sync with initial setup modal
      const initialBgColor = document.getElementById('backgroundColor');
      if (initialBgColor) {
        canvasBgColorInput.value = initialBgColor.value;
      }
      
      canvasBgColorInput.addEventListener('input', (e) => {
        const newColor = e.target.value;
        this.changeBackgroundColor(newColor);
        
        // Also update the initial setup modal if it exists
        if (initialBgColor) {
          initialBgColor.value = newColor;
        }
      });
    }
    
    if (brushGroupEl) {
      brushGroupEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.brush-btn');
        if (!btn || !brushGroupEl.contains(btn)) return;
        this.activeBrushKey = btn.getAttribute('data-brush') || 'soft';
        this._applyActiveBrushSettingsToUIAndBrush();
        if (window.brushRing && window.brushRing.setButtonVisuals) {
          window.brushRing.setButtonVisuals(this.activeBrushKey);
        }
      });
      brushGroupEl.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.brush-btn')) {
          e.preventDefault();
          e.target.click();
        }
      });
    }
    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        this.fitContentToViewport();
        this.render();
      });
    }
  }

  handleKeyDown(e) {
    if (e.code === 'Space' && !this.isSpacePressed) {
      e.preventDefault();
      this.isSpacePressed = true;
      this.viewportCanvas.style.cursor = 'grab';
    }
  }

  handleKeyUp(e) {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      this.isDragging = false;
      this.viewportCanvas.style.cursor = 'default';
    }
  }

  getMousePos(e) {
    const rect = this.viewportCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Convert screen (CSS px) to world/content coordinates using inverse transform
    return {
      x: (mx - this.offsetX) / this.scale,
      y: (my - this.offsetY) / this.scale
    };
  }

  getTouchPos(e) {
    const rect = this.viewportCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    const mx = touch.clientX - rect.left;
    const my = touch.clientY - rect.top;
    return {
      x: (mx - this.offsetX) / this.scale,
      y: (my - this.offsetY) / this.scale
    };
  }

  // Compute midpoint of two touches in screen space (CSS px)
  _getTouchesMidpoint(e) {
    const rect = this.viewportCanvas.getBoundingClientRect();
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const mx = ((t0.clientX + t1.clientX) / 2) - rect.left;
    const my = ((t0.clientY + t1.clientY) / 2) - rect.top;
    return { mx, my };
  }

  // Distance between first two touches in screen space (CSS px)
  _getTouchesDistance(e) {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return Math.hypot(dx, dy);
  }

  _beginPinch(e) {
    if (!e.touches || e.touches.length < 2) return;
    this.isPinching = true;
    this.pinchStartDistance = this._getTouchesDistance(e);
    this.pinchStartScale = this.scale;
    const { mx, my } = this._getTouchesMidpoint(e);
    // Store the world coords under the midpoint to keep it stable while zooming
    this.pinchWorldMidX = (mx - this.offsetX) / this.scale;
    this.pinchWorldMidY = (my - this.offsetY) / this.scale;
  }

  _updatePinch(e) {
    if (!this.isPinching || !e.touches || e.touches.length < 2) return;
    const currentDistance = this._getTouchesDistance(e);
    if (this.pinchStartDistance <= 0) return;
    const factor = currentDistance / this.pinchStartDistance;
    // Clamp scale
    const minScale = Math.max(this.fitScale * 0.25, 0.05);
    const maxScale = 32;
    const newScale = Math.min(maxScale, Math.max(minScale, this.pinchStartScale * factor));

    // Adjust offset so the world point under pinch midpoint remains stationary
    const { mx, my } = this._getTouchesMidpoint(e);
    this.scale = newScale;
    this.offsetX = mx - this.pinchWorldMidX * this.scale;
    this.offsetY = my - this.pinchWorldMidY * this.scale;
    this.render();
  }

  startDrawing(e) {
    // Block drawing while focus mode is active; close focus instead
    const focusActive = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
    if (focusActive) {
      e.preventDefault();
      if (window.brushRing && window.brushRing.exitFocus) window.brushRing.exitFocus();
      // Only consume this event; do not suppress future clicks
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      return;
    }
    if (this._suppressNextMouseDown) {
      this._suppressNextMouseDown = false;
      e.preventDefault();
      return;
    }
    // Right-click opens radial selection and suspends drawing
    if (e && e.button === 2) {
      this._openRadialAt(e.clientX, e.clientY);
      this.isRightMouseSelecting = true;
      // Track mouseup anywhere to finalize selection
      this._docMouseUpHandler = (ev) => {
        const focusActive = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
        if (!focusActive) {
          this._finalizeRadialSelection(ev);
        }
      };
      document.addEventListener('mouseup', this._docMouseUpHandler, { once: true });
      return;
    }
    if (this.isSpacePressed) {
      // Start dragging
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartOffsetX = this.offsetX;
      this.dragStartOffsetY = this.offsetY;
      this.viewportCanvas.style.cursor = 'grabbing';
      return;
    }

    // Normal drawing
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
    this._symmetryBeginAndDot(pos.x, pos.y);
    this.render();
  }

  draw(e) {
    // Do nothing while focus mode is active
    if (window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive()) {
      return;
    }
    // While radial is open, update hover selection and skip drawing
    if (this.isRadialOpen) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        this._updateRadialHover(clientX, clientY);
      }
      return;
    }
    if (this.isDragging) {
      // Handle canvas dragging
      const deltaX = e.clientX - this.dragStartX;
      const deltaY = e.clientY - this.dragStartY;
      this.offsetX = this.dragStartOffsetX + deltaX;
      this.offsetY = this.dragStartOffsetY + deltaY;
      this.render();
      return;
    }

    if (!this.isDrawing) return;
    e.preventDefault();
    const pos = this.getMousePos(e);
    this._symmetryStroke(this.lastX, this.lastY, pos.x, pos.y);
    this.lastX = pos.x;
    this.lastY = pos.y;
    this.render();
  }

  // Legacy helpers replaced by brush system

  handleTouch(e) {
    e.preventDefault();
    // Block drawing while focus mode is active; close focus instead
    const focusActive = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
    if (focusActive) {
      if (e.type === 'touchstart') {
        if (window.brushRing && window.brushRing.exitFocus) window.brushRing.exitFocus();
      }
      return;
    }
    const pos = this.getTouchPos(e);
    if (e.type === 'touchstart') {
      // Record touch start for gesture detection
      this.touchStartTime = Date.now();
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.isTouchGesture = false;

      // Begin pinch gesture if two fingers
      if (e.touches && e.touches.length >= 2) {
        this._beginPinch(e);
        // Ensure we are not in drawing/dragging mode during pinch
        this.isDrawing = false;
        this.isDragging = false;
        this.isTouchGesture = true;
        return;
      }
      if (this.isSpacePressed) {
        // Start dragging
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
        this.dragStartOffsetX = this.offsetX;
        this.dragStartOffsetY = this.offsetY;
        return;
      }

      // Schedule long-press to open radial; defer drawing until move
      this.isDrawing = false;
      this.isLongPressSelecting = false;
      if (this.longPressTimeoutId) clearTimeout(this.longPressTimeoutId);
      const startClientX = e.touches[0].clientX;
      const startClientY = e.touches[0].clientY;
      this.longPressTimeoutId = setTimeout(() => {
        // If still single touch and not dragging/pinching, open radial
        if (!this.isDragging && !this.isPinching) {
          this._openRadialAt(startClientX, startClientY);
          this.isLongPressSelecting = true;
          this._updateRadialHover(startClientX, startClientY);
        }
      }, 400);
    } else if (e.type === 'touchmove') {
      // Handle active pinch gesture
      if (this.isPinching && e.touches && e.touches.length >= 2) {
        this._updatePinch(e);
        return;
      }
      // Single-finger moves are for drawing or radial selection; two-finger handled above

      if (this.isDragging) {
        // Handle canvas dragging
        const deltaX = e.touches[0].clientX - this.dragStartX;
        const deltaY = e.touches[0].clientY - this.dragStartY;
        this.offsetX = this.dragStartOffsetX + deltaX;
        this.offsetY = this.dragStartOffsetY + deltaY;
        this.render();
        return;
      }
      const touch = e.touches[0];
      if (this.isRadialOpen && this.isLongPressSelecting && touch) {
        this._updateRadialHover(touch.clientX, touch.clientY);
        return;
      }
      // If long-press hasn't triggered yet, start drawing on movement and cancel timer
      if (!this.isDrawing && !this.isRadialOpen) {
        if (this.longPressTimeoutId) { clearTimeout(this.longPressTimeoutId); this.longPressTimeoutId = null; }
        this.isDrawing = true;
        this.lastX = pos.x;
        this.lastY = pos.y;
        this._symmetryBeginAndDot(pos.x, pos.y);
        this.render();
        return;
      }
      if (this.isDrawing) {
        this._symmetryStroke(this.lastX, this.lastY, pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.render();
      }
    } else if (e.type === 'touchend' || e.type === 'touchcancel') {
      // End pinch if finger count drops below two
      if (this.isPinching && (!e.touches || e.touches.length < 2)) {
        this.isPinching = false;
        return;
      }
      // Reset gesture state
      this.isTouchGesture = false;
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
      if (this.longPressTimeoutId) { clearTimeout(this.longPressTimeoutId); this.longPressTimeoutId = null; }
      if (this.isRadialOpen && this.isLongPressSelecting) {
        const focusActive = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
        if (!focusActive) {
          this._finalizeRadialSelection();
        }
        return;
      }
    }
  }

  stopDrawing(e) {
    // If radial menu is open, only finalize on release, ignore mouseout
    if (this.isRadialOpen) {
      const type = e && e.type;
      const focusActive = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
      if (!focusActive && (type === 'mouseup' || type === 'touchend' || type === 'touchcancel')) {
        this._finalizeRadialSelection(e);
      }
      return;
    }
    if (this.isDragging) {
      this.isDragging = false;
      if (this.isSpacePressed) {
        this.viewportCanvas.style.cursor = 'grab';
      }
      return;
    }

    this.isDrawing = false;
    const brush = this.getActiveBrush();
    if (brush.endStroke) brush.endStroke();
  }

  // --- Radial settings helpers ---
  _openRadialAt(clientX, clientY) {
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) return;
    settingsPanel.style.left = `${clientX}px`;
    settingsPanel.style.top = `${clientY}px`;
    settingsPanel.removeAttribute('hidden');
    this.isRadialOpen = true;

    // Sync visuals with current active selection when opening
    if (window.brushRing && window.brushRing.setButtonVisuals) {
      window.brushRing.setButtonVisuals(this.activeBrushKey, null);
    }

    // Track cursor/finger globally while open
    this._docMouseMoveHandler = (ev) => {
      if (!this.isRadialOpen) return;
      this._updateRadialHover(ev.clientX, ev.clientY);
    };
    document.addEventListener('mousemove', this._docMouseMoveHandler);

    this._docTouchMoveHandler = (ev) => {
      if (!this.isRadialOpen) return;
      if (ev.touches && ev.touches[0]) {
        this._updateRadialHover(ev.touches[0].clientX, ev.touches[0].clientY);
      }
    };
    document.addEventListener('touchmove', this._docTouchMoveHandler, { passive: false });
  }

  _closeRadial() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) return;
    settingsPanel.setAttribute('hidden', '');
    this.isRadialOpen = false;
    this.isRightMouseSelecting = false;
    this.isLongPressSelecting = false;
    this.currentRadialHoverEl = null;
    if (this._docMouseMoveHandler) {
      document.removeEventListener('mousemove', this._docMouseMoveHandler);
      this._docMouseMoveHandler = null;
    }
    if (this._docTouchMoveHandler) {
      document.removeEventListener('touchmove', this._docTouchMoveHandler);
      this._docTouchMoveHandler = null;
    }
  }

  _updateRadialHover(clientX, clientY) {
    const brushGroupEl = document.querySelector('.brush-group');
    if (!brushGroupEl) return;
    
    const btn = this._hitTestRadialButton(clientX, clientY);
    
    // If we're no longer hovering over any button, clear the current hover
    if (!btn) {
      if (this.currentRadialHoverEl) {
        this.currentRadialHoverEl = null;
        if (window.brushRing && window.brushRing.setButtonVisuals) {
          window.brushRing.setButtonVisuals(this.activeBrushKey, null);
        }
      }
      return;
    }
    
    // If we're hovering over a different button, update the hover
    if (this.currentRadialHoverEl !== btn) {
      this.currentRadialHoverEl = btn;
      if (window.brushRing && window.brushRing.setButtonVisuals) {
        window.brushRing.setButtonVisuals(this.activeBrushKey, btn);
      }
    }
  }

  _finalizeRadialSelection(e) {
    const brushGroupEl = document.querySelector('.brush-group');
    if (!brushGroupEl) { this._closeRadial(); return; }
    // If we have a hovered element, pick it; else try element under pointer
    let targetBtn = this.currentRadialHoverEl;
    if (!targetBtn && e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      targetBtn = this._hitTestRadialButton(e.clientX, e.clientY);
      if (targetBtn && !brushGroupEl.contains(targetBtn)) targetBtn = null;
    }
    if (targetBtn) {
      this.activeBrushKey = targetBtn.getAttribute('data-brush') || 'soft';
      this._applyActiveBrushSettingsToUIAndBrush();
      if (window.brushRing && window.brushRing.setButtonVisuals) {
        window.brushRing.setButtonVisuals(this.activeBrushKey);
      }
    }
    this._closeRadial();
  }

  _hitTestRadialButton(clientX, clientY) {
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

  clearCanvas() {
    // Clear drawing content to transparent; background is drawn during render
    this.contentCtx.clearRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    this.render();
  }

  changeBackgroundColor(color) {
    // Update the background color input if it exists
    const bgColorInput = document.getElementById('backgroundColor');
    if (bgColorInput) {
      bgColorInput.value = color;
    }

    // If content still has a baked background, attempt to convert the previous
    // background color to transparency so future background changes are instant.
    if (this._contentHasBakedBackground) {
      const prevColor = this.backgroundColor;
      try {
        this._unbakeBackgroundColor(prevColor);
        this._contentHasBakedBackground = false;
      } catch (_) {
        // If conversion fails, continue; user will still see new bg behind content
      }
    }

    // Update background color and re-render
    this.backgroundColor = color;
    this.render();
  }

  _unbakeBackgroundColor(prevHex) {
    if (!prevHex || this.contentCanvas.width === 0 || this.contentCanvas.height === 0) return;
    const { r: tr, g: tg, b: tb } = hexToRgb(prevHex);
    const imgData = this.contentCtx.getImageData(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 255 && r === tr && g === tg && b === tb) {
        // Make previous background pixels transparent
        data[i + 3] = 0;
      }
    }
    this.contentCtx.putImageData(imgData, 0, 0);
  }

  saveImage() {
    // Composite background color behind content for formats without alpha (JPEG)
    const outCanvas = document.createElement('canvas');
    outCanvas.width = this.contentCanvas.width;
    outCanvas.height = this.contentCanvas.height;
    const outCtx = outCanvas.getContext('2d');
    outCtx.fillStyle = this.backgroundColor || '#000000';
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    outCtx.drawImage(this.contentCanvas, 0, 0);

    outCanvas.toBlob(async (blob) => {
      try {
        const uuid = this.generateUUID();
        const filename = `${uuid}.jpg`;
        const supabaseUrl = 'https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/ai-art-files-bucket/';
        const uploadUrl = supabaseUrl + filename;
        const formData = new FormData();
        formData.append('file', blob, filename);
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmYWt3bGRxaHJ1bGJzd3lpcW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MDMwNzEsImV4cCI6MjA2Nzk3OTA3MX0.z7SQGca7x0o1pzAaCyZpZDk4IIdhnImUZAdEr-PtGlQ'
          },
          body: formData
        });
        if (response.ok) {
          const publicUrl = `https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/public/ai-art-files-bucket/${filename}`;
          window.alert(`Ապրե´ս, նկարը հաջողությամբ ներմուծվեց!\n\n Կարող ես կոդումդ դնել այս հասցեն նկարն օգտագործելու համար: \n\n ${publicUrl}\n\n`);
        } else {
          throw new Error(`Վայ չստացվեց...: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('Վայ չստացվեց...:', error);
        window.alert(`Վայ չստացվեց...: ${error.message}\n\n Փոխարենը՝ նկարդ քո համակարգչին ներբեռնեցի`);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fallbackFilename = `drawing-${timestamp}.jpg`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fallbackFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }, 'image/jpeg', 0.95);
  }

  async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const uuid = this.generateUUID();
      const filename = `${uuid}.jpg`;
      const supabaseUrl = 'https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/ai-art-files-bucket/';
      const uploadUrl = supabaseUrl + filename;
      let uploadBlob = file;
      if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
        const img = await this.fileToImage(file);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        uploadBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
      }
      const formData = new FormData();
      formData.append('file', uploadBlob, filename);
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmYWt3bGRxaHJ1bGJzd3lpcW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MDMwNzEsImV4cCI6MjA2Nzk3OTA3MX0.z7SQGca7x0o1pzAaCyZpZDk4IIdhnImUZAdEr-PtGlQ'
        },
        body: formData
      });
      if (response.ok) {
        const publicUrl = this.generatePublicLink(filename);
        window.alert(`Ապրե´ս, նկարը հաջողությամբ ներմուծվեց!\n\n Կարող ես կոդումդ դնել այս հասցեն նկարն օգտագործելու համար: \n\n ${publicUrl}\n\n`);
      } else {
        throw new Error(`Վայ չստացվեց...: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Վայ չստացվեց...:', error);
      window.alert(`Վայ չստացվեց...: ${error.message}`);
    } finally {
      e.target.value = '';
    }
  }

  fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (event) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  generateUUID() {
    return createUUID();
  }

  generatePublicLink(filename) {
    return `https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/public/ai-art-files-bucket/${filename}`;
  }

  // --- Viewport helpers ---
  resizeViewportCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.viewportCanvas.getBoundingClientRect();
    // Set canvas internal resolution to match CSS size * DPR for crisp rendering
    this.viewportCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.viewportCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  fitContentToViewport() {
    const rect = this.viewportCanvas.getBoundingClientRect();
    const vw = rect.width;
    const vh = rect.height;
    const cw = this.contentCanvas.width;
    const ch = this.contentCanvas.height;
    if (vw <= 0 || vh <= 0 || cw <= 0 || ch <= 0) return;
    this.fitScale = Math.min(vw / cw, vh / ch);
    this.scale = this.fitScale;
    this.offsetX = (vw - cw * this.scale) / 2;
    this.offsetY = (vh - ch * this.scale) / 2;
  }

  

  handleResize() {
    const prevRect = this.viewportCanvas.getBoundingClientRect();
    const prevCenterScreen = { x: prevRect.width / 2, y: prevRect.height / 2 };
    const prevCenterWorld = {
      x: (prevCenterScreen.x - this.offsetX) / this.scale,
      y: (prevCenterScreen.y - this.offsetY) / this.scale,
    };
    const prevScale = this.scale;
    const prevFit = this.fitScale;

    // Resize viewport backing store
    this.resizeViewportCanvas();

    // Recompute fit scale for the new viewport size
    this.fitContentToViewport();

    // Decide new scale: if user had custom zoom, keep it; otherwise stick to fit
    const userHadCustomZoom = Math.abs(prevScale - prevFit) > 1e-6;
    this.scale = userHadCustomZoom ? prevScale : this.fitScale;

    // Recenter so previous world center stays under screen center
    const rect = this.viewportCanvas.getBoundingClientRect();
    this.offsetX = rect.width / 2 - prevCenterWorld.x * this.scale;
    this.offsetY = rect.height / 2 - prevCenterWorld.y * this.scale;

    this.render();
  }

  handleWheel(e) {
    const rect = this.viewportCanvas.getBoundingClientRect();
    // Desktop pinch-to-zoom (ctrlKey=true)
    if (e.ctrlKey) {
      e.preventDefault();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldXBefore = (mouseX - this.offsetX) / this.scale;
      const worldYBefore = (mouseY - this.offsetY) / this.scale;

      // Zoom factor: smooth exponential zoom
      const zoomIntensity = 0.005 ; // smaller = slower zoom
      const factor = Math.exp(-e.deltaY * zoomIntensity);

      // Clamp scale
      const minScale = Math.max(this.fitScale * 0.25, 0.05);
      const maxScale = 32;
      const newScale = Math.min(maxScale, Math.max(minScale, this.scale * factor));
      this.scale = newScale;

      // Keep world point under cursor fixed
      this.offsetX = mouseX - worldXBefore * this.scale;
      this.offsetY = mouseY - worldYBefore * this.scale;

      this.render();
      return;
    }

    // Otherwise: pan the canvas with wheel deltas (vertical and horizontal)
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 32 : (e.deltaMode === 2 ? rect.height : 1);
    let dx = e.deltaX;
    let dy = e.deltaY;
    // Many mice emit horizontal pan as Shift+vertical; map that when deltaX is 0
    if (e.shiftKey && Math.abs(dx) < 1 && Math.abs(dy) >= 1) {
      dx = dy;
      dy = 0;
    }
    // Scroll down should move content up (inverse relationship)
    const speed = 1.5; // user-preferred pan speed multiplier
    this.offsetX -= dx * unit * speed;
    this.offsetY -= dy * unit * speed;
    this.render();
  }

  render() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.viewportCanvas.getBoundingClientRect();
    const ctx = this.viewportCtx;

    // Ensure backing store matches current size
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (this.viewportCanvas.width !== targetW || this.viewportCanvas.height !== targetH) {
      this.viewportCanvas.width = targetW;
      this.viewportCanvas.height = targetH;
    }

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.viewportCanvas.width, this.viewportCanvas.height);

    // Apply composite transform (DPR first, then world transform)
    ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, this.offsetX * dpr, this.offsetY * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Draw background behind content area
    ctx.fillStyle = this.backgroundColor || '#000000';
    ctx.fillRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    ctx.drawImage(this.contentCanvas, 0, 0);

    // Draw desktop brush hover preview on top of content (only when not drawing and pointer is in canvas)
    if (!this.isDrawing && this._isPointerInCanvas) {
      this._renderBrushPreview(ctx, dpr);
    }
  }

  getActiveBrush() {
    return this.brushes[this.activeBrushKey] || this.brushes.soft;
  }

  // --- Symmetry helpers ---
  _getCanvasCenter() {
    return { x: this.contentCanvas.width / 2, y: this.contentCanvas.height / 2 };
  }

  _rotatePointAround(x, y, cx, cy, angleRad) {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const dx = x - cx;
    const dy = y - cy;
    return { x: cx + dx * cosA - dy * sinA, y: cy + dx * sinA + dy * cosA };
  }

  _symmetryBeginAndDot(x, y) {
    const brush = this.getActiveBrush();
    const axes = this.symmetryAxes | 0;
    if (!axes) {
      brush.beginStroke(x, y);
      brush.strokeTo(x, y, x, y);
      return;
    }
    const { x: cx, y: cy } = this._getCanvasCenter();
    for (let i = 0; i < axes; i++) {
      const angle = (i * Math.PI * 2) / axes;
      const p = this._rotatePointAround(x, y, cx, cy, angle);
      brush.beginStroke(p.x, p.y);
      brush.strokeTo(p.x, p.y, p.x, p.y);
    }
  }

  _symmetryStroke(x0, y0, x1, y1) {
    const brush = this.getActiveBrush();
    const axes = this.symmetryAxes | 0;
    if (!axes) {
      brush.strokeTo(x0, y0, x1, y1);
      return;
    }
    const { x: cx, y: cy } = this._getCanvasCenter();
    for (let i = 0; i < axes; i++) {
      const angle = (i * Math.PI * 2) / axes;
      const p0 = this._rotatePointAround(x0, y0, cx, cy, angle);
      const p1 = this._rotatePointAround(x1, y1, cx, cy, angle);
      brush.strokeTo(p0.x, p0.y, p1.x, p1.y);
    }
  }

  _renderBrushPreview(ctx, dpr) {
    // Convert last pointer client coords to world space
    const rect = this.viewportCanvas.getBoundingClientRect();
    const mx = this._lastPointerClientX - rect.left;
    const my = this._lastPointerClientY - rect.top;
    const worldX = (mx - this.offsetX) / this.scale;
    const worldY = (my - this.offsetY) / this.scale;

    const brush = this.getActiveBrush();
    const radius = Math.max(1, (brush.getPreviewRadius ? brush.getPreviewRadius() : this.brushRadius));

    ctx.save();
    ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, this.offsetX * dpr, this.offsetY * dpr);
    ctx.beginPath();
    ctx.arc(worldX, worldY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,200,200,0.9)';
    ctx.lineWidth = 0.5 / dpr; // keep approximately 0.5 CSS px
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.stroke();
    ctx.restore();
  }

  getBrushSettings(key) {
    return this.brushSettings[key] || { size: this.brushRadius, color: this.brushColor };
  }

  _applyActiveBrushSettingsToUIAndBrush() {
    const s = this.getBrushSettings(this.activeBrushKey);
    const colorInput = document.getElementById('brushColorInput');
    const sizeInput = document.getElementById('brushSizeInput');
    if (colorInput) colorInput.value = s.color || '#ffffff';
    if (sizeInput) sizeInput.value = String(s.size || 10);
    const b = this.getActiveBrush();
    b.setSize(s.size || 10);
    if (b.setColor) b.setColor(s.color || '#ffffff');
    // Update hover preview immediately
    this.render();
    // Update focus color dot
    if (window.brushRing && window.brushRing.updateFocusColor) window.brushRing.updateFocusColor(s.color || '#ffffff');
  }

  setActiveBrushByKey(key) {
    this.activeBrushKey = key || this.activeBrushKey;
    this._applyActiveBrushSettingsToUIAndBrush();
  }

  resetPointerStates() {
    this.isDrawing = false;
    this.isDragging = false;
    this.isPinching = false;
    this.isRightMouseSelecting = false;
    this.isLongPressSelecting = false;
    this._docMouseMoveHandler && document.removeEventListener('mousemove', this._docMouseMoveHandler);
    this._docTouchMoveHandler && document.removeEventListener('touchmove', this._docTouchMoveHandler);
    this._docMouseMoveHandler = null;
    this._docTouchMoveHandler = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new DrawingTool();
});

export default DrawingTool;
