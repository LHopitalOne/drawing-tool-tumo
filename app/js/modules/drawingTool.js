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
    this.brushColor = '#000000';

    // Background color (rendered behind content)
    this.backgroundColor = '#ffffff';
    // Tracks whether the content canvas has the background color baked into pixels
    // Older behavior painted background onto content; we convert on first change
    this._contentHasBakedBackground = true;

    // Symmetry
    this.symmetryAxes = 1; // 1 = single axis; N>1 draws N rotated copies around center

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

    // History stacks for undo/redo
    this.history = [];
    this.redoStack = [];
    this.maxHistory = 50;

    // Focus mode removed

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

    // Toggle inputs based on mode; in upload mode hide size/color and show import button
    const modeRadios = form.querySelectorAll('input[name="mode"]');
    const widthGroup = form.querySelector('label[for="canvasWidth"]').parentElement;
    const heightGroup = form.querySelector('label[for="canvasHeight"]').parentElement;
    const colorGroup = form.querySelector('label[for="backgroundColor"]').parentElement;
    const importActionGroup = document.getElementById('importActionGroup');
    const submitBtn = document.getElementById('setupSubmitBtn');
    const fileInput = document.getElementById('fileInput');
    const importBtn = document.getElementById('importFromSetupBtn');
    const applyVisibility = () => {
      const mode = form.querySelector('input[name="mode"]:checked').value;
      const isUpload = mode === 'upload';
      widthGroup.style.display = isUpload ? 'none' : '';
      heightGroup.style.display = isUpload ? 'none' : '';
      colorGroup.style.display = isUpload ? 'none' : '';
      importActionGroup.style.display = isUpload ? '' : 'none';
      submitBtn.style.display = isUpload ? 'none' : '';
    };
    modeRadios.forEach(r => r.addEventListener('change', applyVisibility));
    applyVisibility();
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }
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
      this.showError('Please enter numeric values for width and height.');
      return;
    }
    if (width < minW || width > maxW || height < minH || height > maxH) {
      this.showError(`The dimensions are incorrect. The width must be between ${minW}–${maxW}, the height must be between ${minH}–${maxH} pixels.`);
      return;
    }
    // Initialize content canvas at requested resolution
    this.contentCanvas.width = width;
    this.contentCanvas.height = height;


    document.getElementById('setupModal').style.display = 'none';
    document.body.classList.remove('modal-open');
    // Animate settings bar emerging after setup closes
    try {
      const bar = document.querySelector('.settings-bar');
      if (bar) {
        bar.classList.add('settings-enter', 'content-hidden');
        requestAnimationFrame(() => {
          bar.classList.remove('settings-enter');
          setTimeout(() => { bar.classList.remove('content-hidden'); }, 140);
        });
      }
    } catch (_) {}

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
    // Seed initial history state
    this._pushHistorySnapshot();
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
    // Seed initial history state
    this._pushHistorySnapshot();
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
    // Sync base properties (use universal size/color)
    Object.values(this.brushes).forEach((b) => {
      b.setSize(this.brushRadius);
      if (b.setColor) b.setColor(this.brushColor);
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
    document.getElementById('clearBtn') && document.getElementById('clearBtn').addEventListener('click', this.clearCanvas.bind(this));
    document.getElementById('saveBtn') && document.getElementById('saveBtn').addEventListener('click', this.saveImage.bind(this));
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      // File input is wired from setup modal now; keep listener
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

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

    // Focus size-change event removed.

    // Select brush from radial focus UI
    document.addEventListener('brush:select', (e) => {
      const key = e.detail && e.detail.key ? e.detail.key : null;
      if (!key) return;
      this.setActiveBrushByKey(key);
      if (window.brushRing && window.brushRing.setButtonVisuals) window.brushRing.setButtonVisuals(this.activeBrushKey);
    });

    // Focus exit removed.

    // Focus click-to-exit removed.

    // Floating settings UI
    const fabToggle = document.getElementById('fabToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const sizeInput = document.getElementById('topBrushSize');
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
    if (sizeInput) {
      sizeInput.value = String(this.brushRadius);
      sizeInput.addEventListener('input', (e) => {
        const val = Math.max(1, Math.min(400, parseInt(e.target.value || '1', 10)));
        this.brushRadius = val;
        Object.values(this.brushes).forEach((b) => b.setSize(val));
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
    // Ignore shortcuts while typing in inputs or contenteditable areas
    const active = document.activeElement;
    const tag = active && active.tagName ? active.tagName.toLowerCase() : '';
    const isTextField = tag === 'input' || tag === 'textarea' || (active && active.isContentEditable);

    // Global app shortcuts
    const isModifier = (e.ctrlKey || e.metaKey) && !isTextField;
    if (isModifier) {
      const key = (e.key || '').toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo(); else this.undo();
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        this.redo();
        return;
      }
      if (key === 's') {
        e.preventDefault();
        this.saveImage();
        return;
      }
    }

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

  // Returns true when the color picker modal is currently open
  isColorPickerOpen() {
    try {
      return Boolean(document.querySelector('.color-picker.cp-open'));
    } catch (_) {
      return false;
    }
  }

  // Pinch/zoom handled by ViewportController

  startDrawing(e) {
    // If color picker is open, ignore canvas clicks so it can close without drawing
    if (this.isColorPickerOpen()) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      return;
    }
    // Focus mode removed
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
    // Ignore drawing while color picker is open
    if (this.isColorPickerOpen()) {
      return;
    }
    // Focus mode removed
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
    // Ignore touch interactions while color picker is open
    if (this.isColorPickerOpen()) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    // Focus mode removed
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
        this.radial.finalizeSelection();
        return;
      }
    }
  }

  stopDrawing(e) {
    // If radial menu is open, only finalize on release, ignore mouseout
    if (this.radial.isOpen()) {
      const type = e && e.type;
      if (type === 'mouseup' || type === 'touchend' || type === 'touchcancel') {
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
    if (brush.endStroke) this._symmetryEndStroke();
    // Snapshot after finishing a stroke
    this._pushHistorySnapshot();
  }

  // --- Radial settings helpers moved to controllers/RadialController ---

  clearCanvas() {
    // Clear drawing content to transparent; background is drawn during render
    this.contentCtx.clearRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    this.render();
    // Push history so clear is undoable
    this._pushHistorySnapshot();
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
    outCtx.fillStyle = this.backgroundColor || '#ffffff';
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    outCtx.drawImage(this.contentCanvas, 0, 0);

    (async () => {
      try {
        const blob = await storage.canvasToJpegBlob(outCanvas, 0.95);
        const filename = storage.createFilename('jpg');
        const publicUrl = await storage.uploadBlobToSupabase(blob, filename);
        window.alert(`Successfully uploaded the image!\n\n You can use this URL to embed the image: \n\n ${publicUrl}\n\n`);
      } catch (error) {
        console.error('Failed to upload the image:', error);
        window.alert(`Failed to upload the image: ${error.message}\n\n Instead, I downloaded the image to your computer.`);
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

  // --- Undo/Redo stubs ---
  undo() {
    // Need at least two states: current and a previous one
    if (this.history.length <= 1) return;
    // Pop current and move it to redo
    const current = this.history.pop();
    this.redoStack.push(current);
    // Apply new top (previous state)
    const prev = this.history[this.history.length - 1];
    this._applySnapshot(prev);
    this.render();
  }
  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    // Apply and push as new current
    this._applySnapshot(next);
    this.history.push(next);
    this.render();
  }

  _captureSnapshot() {
    // Snapshot only content pixels (alpha preserved). Store as ImageData for speed/memory
    try {
      return this.contentCtx.getImageData(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    } catch (_) {
      // Fallback to offscreen canvas if tainted or other issues
      const c = document.createElement('canvas');
      c.width = this.contentCanvas.width;
      c.height = this.contentCanvas.height;
      c.getContext('2d').drawImage(this.contentCanvas, 0, 0);
      return c;
    }
  }

  _applySnapshot(snap) {
    if (!snap) return;
    if (snap instanceof ImageData) {
      this.contentCtx.putImageData(snap, 0, 0);
    } else if (snap instanceof HTMLCanvasElement) {
      this.contentCtx.clearRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
      this.contentCtx.drawImage(snap, 0, 0);
    }
  }

  _pushHistorySnapshot() {
    const snap = this._captureSnapshot();
    const last = this.history[this.history.length - 1];
    // Deduplicate identical sizes and content by comparing dimensions and a small sample
    if (last && last.width === snap.width && last.height === snap.height) {
      try {
        const a = last.data, b = snap.data;
        let same = true;
        for (let i = 0; i < a.length; i += Math.max(16, (a.length / 1024) | 0)) {
          if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2] || a[i+3] !== b[i+3]) { same = false; break; }
        }
        if (same) return; // skip pushing identical snapshot
      } catch (_) {}
    }
    // Clear redo on new distinct action
    this.redoStack.length = 0;
    this.history.push(snap);
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const filename = storage.createFilename('jpg');
      const jpegBlob = await storage.ensureJpegBlob(file);
      const publicUrl = await storage.uploadBlobToSupabase(jpegBlob, filename);
      window.alert(`Successfully uploaded the image!\n\n You can use this URL to embed the image: \n\n ${publicUrl}\n\n`);
    } catch (error) {
      console.error('Failed to upload the image:', error);
      window.alert(`Failed to upload the image: ${error.message}`);
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
    ctx.fillStyle = this.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    ctx.drawImage(this.contentCanvas, 0, 0);

    // Draw symmetry axes guide when enabled
    this._renderSymmetryAxes(ctx, dpr);

    // Draw a thin outline around the drawable content area
    // Keep the stroke 1px in screen space regardless of zoom/DPR
    ctx.save();
    {
      const scale = (this.viewport && this.viewport.scale) ? this.viewport.scale : 1;
      const screenPx = 1 / (scale * dpr);
      ctx.lineWidth = screenPx;
      ctx.strokeStyle = 'rgb(127,127,127)';
      ctx.globalAlpha = 1;
      ctx.strokeRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    }
    ctx.restore();

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

  _symmetryEndStroke() {
    const brush = this.getActiveBrush();
    const axes = this.symmetryAxes | 0;
    symmetry.endStroke(brush, axes);
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

  _renderSymmetryAxes(ctx, dpr) {
    const axes = this.symmetryAxes | 0;
    if (!axes || axes <= 1) return;
    const w = this.contentCanvas.width;
    const h = this.contentCanvas.height;
    if (w <= 0 || h <= 0) return;
    const cx = w / 2;
    const cy = h / 2;
    const halfDiag = Math.hypot(w, h) * 0.5 + 2;

    ctx.save();
    // Make line width ~0.5px in screen space
    const scale = (this.viewport && this.viewport.scale) ? this.viewport.scale : 1;
    const screenPx = Math.max(0.25, 0.5 / (scale * dpr));
    ctx.lineWidth = screenPx;
    ctx.strokeStyle = 'rgb(127,127,127)';
    ctx.globalAlpha = 0.6;
    // Draw exactly `axes` rays separated by 2π/N, from center outward (N sectors)
    ctx.beginPath();
    for (let i = 0; i < axes; i++) {
      const angle = (i * Math.PI * 2) / axes;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * halfDiag, cy + dy * halfDiag);
    }
    ctx.stroke();
    ctx.restore();
  }

  getBrushSettings() {
    // Universal settings for all brushes
    return { size: this.brushRadius, color: this.brushColor };
  }

  _applyActiveBrushSettingsToUIAndBrush() {
    const s = this.getBrushSettings();
    const sizeInput = document.getElementById('topBrushSize');
    if (sizeInput) sizeInput.value = String(s.size || 10);
    // Apply universal settings to all brushes
    Object.values(this.brushes).forEach((b) => {
      b.setSize(s.size || 10);
      if (b.setColor) b.setColor(s.color || '#ffffff');
    });
    // Update hover preview immediately
    this.render();
    // Focus color sync removed
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
