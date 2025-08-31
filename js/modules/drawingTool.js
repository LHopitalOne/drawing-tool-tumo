// Import brush classes from modules
import {
  SoftBrush,
  PenBrush,
  Airbrush,
  FountainPen,
  PencilBrush,
  EraserBrush
} from './brushes/index.js';
import { hexToRgb } from './utils.js';
import * as storage from './services/storage.js';
import { RadialController } from './controllers/radialController.js';
import { ViewportController } from './controllers/viewportController.js';
import * as symmetry from './math/symmetry.js';
import { renderBrushPreview } from './render/preview.js';

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

    // Viewport controller (pan/zoom/fit)
    this.viewport = new ViewportController(this.viewportCanvas);

    // Dragging state
    this.isSpacePressed = false;

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

    // Radial (settings) controller
    this.radial = new RadialController();
    this.longPressTimeoutId = null;

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
    this.viewport.resizeBackingStore();
    this.viewport.fitToContent(this.contentCanvas.width, this.contentCanvas.height);
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

    this.viewport.resizeBackingStore();
    this.viewport.fitToContent(this.contentCanvas.width, this.contentCanvas.height);
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
      if (!this.isDrawing && !this.radial.isOpen()) this.render();
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
        this.viewport.fitToContent(this.contentCanvas.width, this.contentCanvas.height);
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
    return this.viewport.worldFromClient(e.clientX, e.clientY);
  }

  getTouchPos(e) {
    const t = e.touches[0];
    return this.viewport.worldFromClient(t.clientX, t.clientY);
  }

  // Pinch/zoom handled by ViewportController

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
      this.radial.openAt(e.clientX, e.clientY, { via: 'mouse' });
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
    if (this.radial.isOpen()) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        this.radial.updateHover(clientX, clientY);
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
          this.radial.openAt(startClientX, startClientY, { via: 'touch' });
          this.radial.setLongPressSelecting(true);
          this.radial.updateHover(startClientX, startClientY);
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
      if (this.radial.isOpen() && this.radial.isLongPressSelecting() && touch) {
        this.radial.updateHover(touch.clientX, touch.clientY);
        return;
      }
      // If long-press hasn't triggered yet, start drawing on movement and cancel timer
      if (!this.isDrawing && !this.radial.isOpen()) {
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
      if (this.radial.isOpen() && this.radial.isLongPressSelecting()) {
        const focusActive = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
        if (!focusActive) {
          this.radial.finalizeSelection();
        }
        return;
      }
    }
  }

  stopDrawing(e) {
    // If radial menu is open, only finalize on release, ignore mouseout
    if (this.radial.isOpen()) {
      const type = e && e.type;
      const focusActive = !!(window.brushRing && window.brushRing.isFocusActive && window.brushRing.isFocusActive());
      if (!focusActive && (type === 'mouseup' || type === 'touchend' || type === 'touchcancel')) {
        this.radial.finalizeSelection(e);
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

  // --- Radial settings helpers moved to controllers/RadialController ---

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
    // Composite background behind content for formats without alpha (JPEG)
    const outCanvas = document.createElement('canvas');
    outCanvas.width = this.contentCanvas.width;
    outCanvas.height = this.contentCanvas.height;
    const outCtx = outCanvas.getContext('2d');
    outCtx.fillStyle = this.backgroundColor || '#000000';
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    outCtx.drawImage(this.contentCanvas, 0, 0);

    (async () => {
      try {
        const blob = await storage.canvasToJpegBlob(outCanvas, 0.95);
        const filename = storage.createFilename('jpg');
        const publicUrl = await storage.uploadBlobToSupabase(blob, filename);
        window.alert(`Ապրե´ս, նկարը հաջողությամբ ներմուծվեց!\n\n Կարող ես կոդումդ դնել այս հասցեն նկարն օգտագործելու համար: \n\n ${publicUrl}\n\n`);
      } catch (error) {
        console.error('Վայ չստացվեց...:', error);
        window.alert(`Վայ չստացվեց...: ${error.message}\n\n Փոխարենը՝ նկարդ քո համակարգչին ներբեռնեցի`);
        try {
          const blob = await storage.canvasToJpegBlob(outCanvas, 0.95);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fallbackFilename = `drawing-${timestamp}.jpg`;
          const url = storage.fileOrBlobToObjectUrl(blob);
          storage.fileOrBlobDownload(url, fallbackFilename);
          storage.revokeObjectUrl(url);
        } catch (_) {}
      }
    })();
  }

  async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const filename = storage.createFilename('jpg');
      const jpegBlob = await storage.ensureJpegBlob(file);
      const publicUrl = await storage.uploadBlobToSupabase(jpegBlob, filename);
      window.alert(`Ապրե´ս, նկարը հաջողությամբ ներմուծվեց!\n\n Կարող ես կոդումդ դնել այս հասցեն նկարն օգտագործելու համար: \n\n ${publicUrl}\n\n`);
    } catch (error) {
      console.error('Վայ չստացվեց...:', error);
      window.alert(`Վայ չստացվեց...: ${error.message}`);
    } finally {
      e.target.value = '';
    }
  }


  handleResize() {
    this.viewport.onResize(this.contentCanvas.width, this.contentCanvas.height);
    this.render();
  }

  handleWheel(e) {
    this.viewport.wheel(e);
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
    ctx.setTransform(this.viewport.scale * dpr, 0, 0, this.viewport.scale * dpr, this.viewport.offsetX * dpr, this.viewport.offsetY * dpr);
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

  // --- Symmetry helpers (delegated)
  _symmetryBeginAndDot(x, y) {
    const brush = this.getActiveBrush();
    const axes = this.symmetryAxes | 0;
    const { x: cx, y: cy } = symmetry.getCanvasCenter(this.contentCanvas);
    symmetry.beginAndDot(brush, x, y, axes, cx, cy);
  }

  _symmetryStroke(x0, y0, x1, y1) {
    const brush = this.getActiveBrush();
    const axes = this.symmetryAxes | 0;
    const { x: cx, y: cy } = symmetry.getCanvasCenter(this.contentCanvas);
    symmetry.stroke(brush, x0, y0, x1, y1, axes, cx, cy);
  }

  _renderBrushPreview(ctx, dpr) {
    const brush = this.getActiveBrush();
    const radius = Math.max(1, (brush.getPreviewRadius ? brush.getPreviewRadius() : this.brushRadius));
    renderBrushPreview(
      ctx,
      dpr,
      this.viewportCanvas,
      this.viewport.scale,
      this.viewport.offsetX,
      this.viewport.offsetY,
      this._lastPointerClientX,
      this._lastPointerClientY,
      radius,
    );
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
  }
}

export default DrawingTool;
