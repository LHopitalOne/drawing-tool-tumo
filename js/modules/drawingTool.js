// Import brush classes from modules
import {
  SoftBrush,
  PenBrush,
  Airbrush,
  FountainPen,
  PencilBrush,
  EraserBrush
} from './brushes/index.js';
import { generateUUID as createUUID } from './utils.js';

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

    // Active brush
    this.brushes = {};
    this.activeBrushKey = 'soft';

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

    // Bind resize handler
    this.handleResize = this.handleResize.bind(this);

    this.setupModal();
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
    // Initialize content canvas background and brush
    this.contentCtx.fillStyle = document.getElementById('backgroundColor').value;
    this.contentCtx.fillRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    this.contentCtx.strokeStyle = this.brushColor;
    this.contentCtx.lineWidth = 1;
    this.contentCtx.lineCap = 'round';
    this.contentCtx.lineJoin = 'round';
    this.initializeBrushes();

    // Prepare viewport and fit content
    this.resizeViewportCanvas();
    this.fitContentToViewport();
    this.render();
  }

  initForUpload() {
    this.contentCtx.fillStyle = document.getElementById('backgroundColor').value;
    this.contentCtx.fillRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
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
    Object.values(this.brushes).forEach(b => { b.setSize(this.brushRadius); b.setColor(this.brushColor); });
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

    // Wheel zoom (Photoshop-like zoom towards cursor)
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

    // Floating settings UI
    const fabToggle = document.getElementById('fabToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const colorInput = document.getElementById('brushColorInput');
    const sizeInput = document.getElementById('brushSizeInput');
    const fitBtn = document.getElementById('fitViewBtn');
    const brushButtons = Array.from(document.querySelectorAll('.brush-btn'));

    if (fabToggle && settingsPanel) {
      fabToggle.addEventListener('click', () => {
        const isHidden = settingsPanel.hasAttribute('hidden');
        if (isHidden) {
          settingsPanel.removeAttribute('hidden');
          fabToggle.setAttribute('aria-expanded', 'true');
        } else {
          settingsPanel.setAttribute('hidden', '');
          fabToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
    if (closeSettingsBtn && settingsPanel && fabToggle) {
      closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.setAttribute('hidden', '');
        fabToggle.setAttribute('aria-expanded', 'false');
      });
    }

    if (colorInput) {
      colorInput.value = this.brushColor;
      colorInput.addEventListener('input', (e) => {
        this.brushColor = e.target.value || '#ffffff';
        Object.values(this.brushes).forEach(b => b.setColor(this.brushColor));
      });
    }
    if (sizeInput) {
      sizeInput.value = String(this.brushRadius);
      sizeInput.addEventListener('input', (e) => {
        const val = Math.max(1, Math.min(400, parseInt(e.target.value || '1', 10)));
        this.brushRadius = val;
        Object.values(this.brushes).forEach(b => b.setSize(val));
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
    
    if (brushButtons.length) {
      brushButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          brushButtons.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          this.activeBrushKey = btn.getAttribute('data-brush') || 'soft';
        });
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

  startDrawing(e) {
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
    this.getActiveBrush().beginStroke(pos.x, pos.y);
    this.getActiveBrush().strokeTo(pos.x, pos.y, pos.x, pos.y);
    this.render();
  }

  draw(e) {
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
    this.getActiveBrush().strokeTo(this.lastX, this.lastY, pos.x, pos.y);
    this.lastX = pos.x;
    this.lastY = pos.y;
    this.render();
  }

  // Legacy helpers replaced by brush system

  handleTouch(e) {
    e.preventDefault();
    const pos = this.getTouchPos(e);
    if (e.type === 'touchstart') {
      if (this.isSpacePressed) {
        // Start dragging
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
        this.dragStartOffsetX = this.offsetX;
        this.dragStartOffsetY = this.offsetY;
        return;
      }

      // Normal drawing
      this.isDrawing = true;
      this.lastX = pos.x;
      this.lastY = pos.y;
      this.getActiveBrush().beginStroke(pos.x, pos.y);
      this.getActiveBrush().strokeTo(pos.x, pos.y, pos.x, pos.y);
      this.render();
    } else if (e.type === 'touchmove') {
      if (this.isDragging) {
        // Handle canvas dragging
        const deltaX = e.touches[0].clientX - this.dragStartX;
        const deltaY = e.touches[0].clientY - this.dragStartY;
        this.offsetX = this.dragStartOffsetX + deltaX;
        this.offsetY = this.dragStartOffsetY + deltaY;
        this.render();
        return;
      }

      if (this.isDrawing) {
        this.getActiveBrush().strokeTo(this.lastX, this.lastY, pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.render();
      }
    }
  }

  stopDrawing() {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.isSpacePressed) {
        this.viewportCanvas.style.cursor = 'grab';
      }
      return;
    }

    this.isDrawing = false;
    if (this.getActiveBrush().endStroke) this.getActiveBrush().endStroke();
  }

  clearCanvas() {
    this.contentCtx.fillStyle = document.getElementById('backgroundColor').value;
    this.contentCtx.fillRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    this.render();
  }

  changeBackgroundColor(color) {
    // Update the background color input if it exists
    const bgColorInput = document.getElementById('backgroundColor');
    if (bgColorInput) {
      bgColorInput.value = color;
    }
    
    // Redraw the entire canvas with new background color
    this.contentCtx.fillStyle = color;
    this.contentCtx.fillRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
    
    // Re-render to show the change
    this.render();
  }

  saveImage() {
    this.contentCanvas.toBlob(async (blob) => {
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
    e.preventDefault();
    const rect = this.viewportCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldXBefore = (mouseX - this.offsetX) / this.scale;
    const worldYBefore = (mouseY - this.offsetY) / this.scale;

    // Zoom factor: similar to Photoshop, smooth exponential zoom
    const zoomIntensity = 0.0015; // smaller = slower zoom
    const factor = Math.exp(-e.deltaY * zoomIntensity);

    // Clamp scale
    const minScale = Math.max(this.fitScale * 0.25, 0.05);
    const maxScale = 32;
    const newScale = Math.min(maxScale, Math.max(minScale, this.scale * factor));
    const scaleChange = newScale / this.scale;
    this.scale = newScale;

    // Adjust offset so the world point under cursor stays stationary in screen space
    this.offsetX = mouseX - worldXBefore * this.scale;
    this.offsetY = mouseY - worldYBefore * this.scale;

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
    ctx.drawImage(this.contentCanvas, 0, 0);
  }

  getActiveBrush() {
    return this.brushes[this.activeBrushKey] || this.brushes.soft;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new DrawingTool();
});

export default DrawingTool;
