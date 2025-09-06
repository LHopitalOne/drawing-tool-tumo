// Radial ring composed of circular icon buttons

const ICONS = {
  soft: {
    normal: 'graphics/brush_not-selected.svg',
    selected: 'graphics/brush_selected.svg',
  },
  pen: {
    normal: 'graphics/pen_not-selected.svg',
    selected: 'graphics/pen_selected.svg',
  },
  air: {
    normal: 'graphics/spray_not-selected.svg',
    selected: 'graphics/spray_selected.svg',
  },
  fountain: {
    normal: 'graphics/fountain_not-selected.svg',
    selected: 'graphics/fountain_selected.svg',
  },
  pencil: {
    normal: 'graphics/pencil_not-selected.svg',
    selected: 'graphics/pencil_selected.svg',
  },
  eraser: {
    normal: 'graphics/eraser_not-selected.svg',
    selected: 'graphics/eraser_selected.svg',
  },
};

// In-memory data URI cache so we never refetch on open/hover
const PRELOADED_ICONS = {};
let _prevHoverEl = null;
let _prevActiveKey = null;

// Focus mode removed

async function preloadSvgToDataUri(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  const text = await res.text();
  // Ensure proper data URI encoding for SVG
  const encoded = encodeURIComponent(text)
    .replace(/%0A/g, '\n')
    .replace(/%20/g, ' ');
  return `data:image/svg+xml;utf8,${encoded}`;
}

async function preloadAllIcons() {
  const entries = Object.entries(ICONS);
  await Promise.all(entries.map(async ([key, val]) => {
    const normal = await preloadSvgToDataUri(val.normal);
    const selected = await preloadSvgToDataUri(val.selected);
    PRELOADED_ICONS[key] = { normal, selected };
  }));
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function createCircleButton(brushKey, label, angleDeg, distancePx, sizePx) {
  const btn = document.createElement('button');
  btn.setAttribute('type', 'button');
  btn.setAttribute('class', 'brush-btn');
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.setAttribute('aria-label', label);
  btn.setAttribute('data-brush', brushKey);
  btn.style.width = `${sizePx}px`;
  btn.style.height = `${sizePx}px`;
  btn.style.left = '50%';
  btn.style.top = '50%';
  // Use CSS custom properties for positioning so hover transforms work
  btn.style.setProperty('--angle', `${angleDeg}deg`);
  btn.style.setProperty('--distance', `${distancePx}px`);

  const imgSVG = document.createElement('embed');
  imgSVG.setAttribute('alt', label);
  imgSVG.setAttribute('type', 'image/svg+xml');
  const icon = PRELOADED_ICONS[brushKey] || ICONS[brushKey] || ICONS.soft;
  imgSVG.src = icon.normal;
  btn.appendChild(imgSVG);
  btn.dataset.iconState = 'normal';

  return btn;
}

// Focus mode removed

// Focus mode removed

// Focus mode removed

// Focus mode removed

// Focus mode removed

export function initBrushRing(config = {}) {
  const group = document.querySelector('.brush-group');
  if (!group) return;

  const brushes = [
    { key: 'soft', label: 'Soft brush' },
    { key: 'pen', label: 'Pen' },
    { key: 'air', label: 'Airbrush' },
    { key: 'fountain', label: 'Fountain pen' },
    { key: 'pencil', label: 'Pencil' },
    { key: 'eraser', label: 'Eraser' },
  ];

  const count = Number.isFinite(config.count) ? clamp(config.count, 1, 24) : brushes.length;
  const buttonSize = Number.isFinite(config.buttonSize) ? config.buttonSize : Math.round(window.innerHeight * 0.07) || 56;
  const distance = Number.isFinite(config.distance) ? config.distance : Math.round(window.innerHeight * 0.09) || 72;

  group.innerHTML = '';

  const step = 360 / count;
  brushes.slice(0, count).forEach((b, idx) => {
    const angle = idx * step;
    const btn = createCircleButton(b.key, b.label, angle, distance, buttonSize);
    group.appendChild(btn);
  });

  // Expose API to update dynamically
  window.brushRing = window.brushRing || {};
  window.brushRing.setConfig = (next) => initBrushRing({
    count,
    buttonSize,
    distance,
    ...next,
  });
  window.brushRing.setButtonVisuals = (activeKey, hoverEl) => {
    const updateNodeIcon = (node, forceSelected) => {
      if (!node) return;
      const key = node.getAttribute('data-brush');
      const imgSVG = node.querySelector('embed');
      if (!imgSVG) return;
      const icon = PRELOADED_ICONS[key] || ICONS[key] || ICONS.soft;
      const shouldSelected = Boolean(forceSelected || (activeKey && activeKey === key));
      const desired = shouldSelected ? icon.selected : icon.normal;
      if (node.dataset.iconState === (shouldSelected ? 'selected' : 'normal')) return;
      imgSVG.src = desired;
      node.dataset.iconState = shouldSelected ? 'selected' : 'normal';
    };

    const nodes = group.querySelectorAll('.brush-btn');
    nodes.forEach((node) => {
      const key = node.getAttribute('data-brush');
      const isActive = Boolean(activeKey && activeKey === key);
      const isHover = Boolean(hoverEl && hoverEl === node);
      if (isActive) node.classList.add('selected'); else node.classList.remove('selected');
      node.style.visibility = 'visible';
      updateNodeIcon(node, isActive || isHover);
    });

    _prevHoverEl = hoverEl || null;
    _prevActiveKey = activeKey || null;
  };
  window.brushRing.preloadPromise = Promise.resolve();
  // Focus APIs removed
}

// Auto-init on DOMContentLoaded to ensure container exists
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await preloadAllIcons();
    initBrushRing();
  } catch (_) {
    // If preloading fails, fall back to file URLs; still init ring
    initBrushRing();
  }
  // Initialize top bar interactions
  try {
    initTopBar();
  } catch (_) {}
});

export default initBrushRing;

// --- Top bar UI controller ---
function initTopBar() {
  const bgIndicator = document.getElementById('canvasBgIndicator');
  const brushColorIndicator = document.getElementById('brushColorIndicator');
  const sizeInput = document.getElementById('topBrushSize');
  const symmetryInput = document.getElementById('symmetryTopInput');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  // Long-press reveal setup for pairs (works for mouse and touch)
  const revealPairs = document.querySelectorAll('.hover-reveal');
  revealPairs.forEach((pair) => {
    const primary = pair.querySelector('.chip-button:not(.secondary)');
    const secondary = pair.querySelector('.chip-button.secondary');
    if (!primary || !secondary) return;

    let pressTimer = null;
    let isRevealed = false;

    const open = () => {
      isRevealed = true;
      pair.classList.remove('closing');
      pair.classList.add('reveal');
    };
    const close = () => {
      isRevealed = false;
      // Play reverse animation by toggling a closing state
      pair.classList.remove('reveal');
      pair.classList.add('closing');
      // Ensure we remove closing after transition
      const sec = secondary;
      const onEnd = () => {
        pair.classList.remove('closing');
        sec.removeEventListener('transitionend', onEnd);
      };
      sec.addEventListener('transitionend', onEnd);
    };
    const scheduleOpen = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(open, 350);
    };
    const cancelOpen = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };

    // Mouse long-press
    primary.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // left button only
      scheduleOpen();
    });
    ['mouseup', 'mouseleave'].forEach((ev) => primary.addEventListener(ev, cancelOpen));

    // Touch long-press
    primary.addEventListener('touchstart', scheduleOpen, { passive: true });
    ['touchend', 'touchcancel'].forEach((ev) => primary.addEventListener(ev, cancelOpen, { passive: true }));

    // Keep open while pointer is over either element; close when truly leaving both
    let inside = false;
    const onEnter = () => { inside = true; if (isRevealed) open(); };
    const onLeave = () => {
      inside = false;
      setTimeout(() => { if (!inside) close(); }, 120);
    };
    pair.addEventListener('mouseenter', onEnter);
    pair.addEventListener('mouseleave', onLeave);
    secondary.addEventListener('mouseenter', onEnter);
    secondary.addEventListener('mouseleave', onLeave);

    // Click on primary should act normally if not revealed
    primary.addEventListener('click', (e) => {
      if (isRevealed) {
        // If already revealed, clicking primary should just close the menu
        e.preventDefault();
        close();
      }
    });
  });

  // Initialize indicators
  const bg = document.getElementById('backgroundColor');
  if (bg && bgIndicator) bgIndicator.style.background = bg.value;
  {
    const dt = window.drawingTool;
    if (dt && brushColorIndicator) {
      const s = dt.getBrushSettings(dt.activeBrushKey);
      brushColorIndicator.style.background = s.color || '#ffffff';
    }
  }

  // Keep indicators in sync when app changes values
  const syncIndicators = () => {
    try {
      const bgInput = document.getElementById('backgroundColor');
      if (bgInput && bgIndicator) bgIndicator.style.background = bgInput.value;
      const dt = window.drawingTool;
      if (dt) {
        const s = dt.getBrushSettings(dt.activeBrushKey);
        if (brushColorIndicator) brushColorIndicator.style.background = s.color || '#ffffff';
        if (sizeInput) sizeInput.value = String(s.size || 10);
        if (symmetryInput) symmetryInput.value = String(dt.symmetryAxes || 1);
      }
    } catch (_) {}
  };
  setInterval(syncIndicators, 400);

  // Lazy import color picker to avoid cyclic deps
  let ColorPickerModal = null;
  const ensurePicker = async () => {
    if (!ColorPickerModal) {
      const m = await import('./colorPicker.js');
      ColorPickerModal = m.default || m.ColorPickerModal;
    }
    return ColorPickerModal;
  };

  const openPicker = async (anchorEl, getHex, setHex) => {
    if (!anchorEl) return;
    const current = typeof getHex === 'function' ? getHex() : '#ffffff';
    const Picker = await ensurePicker();
    if (anchorEl._cp) { anchorEl._cp.destroy(); anchorEl._cp = null; }
    anchorEl._cp = new Picker({
      anchorEl,
      initialHex: current,
      onChange: (hex) => { if (typeof setHex === 'function') setHex(hex); },
      onClose: () => { anchorEl._cp = null; },
    });
  };

  if (bgIndicator) {
    bgIndicator.addEventListener('click', () => {
      openPicker(
        bgIndicator,
        () => document.getElementById('backgroundColor')?.value || '#000000',
        (hex) => {
          const input = document.getElementById('backgroundColor');
          if (input) { input.value = hex; }
          if (window.drawingTool) window.drawingTool.changeBackgroundColor(hex);
          bgIndicator.style.background = hex;
        }
      );
    });
  }
  if (brushColorIndicator) {
    brushColorIndicator.addEventListener('click', () => {
      const dt = window.drawingTool;
      openPicker(
        brushColorIndicator,
        () => {
          if (!dt) return '#ffffff';
          const s = dt.getBrushSettings(dt.activeBrushKey);
          return s.color || '#ffffff';
        },
        (hex) => {
          if (!dt) return;
          const key = dt.activeBrushKey;
          dt.brushSettings[key] = { ...dt.getBrushSettings(key), color: hex };
          const b = dt.getActiveBrush();
          if (b.setColor) b.setColor(hex);
          brushColorIndicator.style.background = hex;
          dt.render();
        }
      );
    });
  }

  // Numeric inputs
  if (sizeInput) {
    sizeInput.addEventListener('input', (e) => {
      const dt = window.drawingTool;
      if (!dt) return;
      const val = Math.max(1, Math.min(400, parseInt(e.target.value || '1', 10)));
      const key = dt.activeBrushKey;
      dt.brushSettings[key] = { ...dt.getBrushSettings(key), size: val };
      dt.getActiveBrush().setSize(val);
      dt.render();
    });

    // Drag horizontally to change number
    let dragging = false;
    let startX = 0;
    let startVal = 0;
    let dragTimeout = null;
    const pxPerUnit = 4; // drag sensitivity
    sizeInput.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startVal = parseInt(sizeInput.value || '10', 10);
      
      // Delay drag initiation to allow normal click/focus behavior
      dragTimeout = setTimeout(() => {
        dragging = true;
        document.body.style.cursor = 'ew-resize';
      }, 150);
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) {
        // Check if mouse has moved enough to start dragging immediately
        const deltaX = Math.abs(e.clientX - startX);
        if (deltaX > 5 && dragTimeout) {
          clearTimeout(dragTimeout);
          dragging = true;
          document.body.style.cursor = 'ew-resize';
        } else {
          return;
        }
      }
      
      const delta = Math.round((e.clientX - startX) / pxPerUnit);
      const next = Math.max(1, Math.min(400, startVal + delta));
      if (next !== parseInt(sizeInput.value || '0', 10)) {
        sizeInput.value = String(next);
        sizeInput.dispatchEvent(new Event('input'));
      }
    });
    window.addEventListener('mouseup', () => {
      // Clear timeout if it's still pending (was a quick click)
      if (dragTimeout) {
        clearTimeout(dragTimeout);
        dragTimeout = null;
      }
      
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
    });
    // Touch drag
    sizeInput.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      dragging = true;
      startX = t.clientX;
      startVal = parseInt(sizeInput.value || '10', 10);
    }, { passive: true });
    sizeInput.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      const delta = Math.round((t.clientX - startX) / pxPerUnit);
      const next = Math.max(1, Math.min(400, startVal + delta));
      if (next !== parseInt(sizeInput.value || '0', 10)) {
        sizeInput.value = String(next);
        sizeInput.dispatchEvent(new Event('input'));
      }
    }, { passive: true });
    sizeInput.addEventListener('touchend', () => { dragging = false; }, { passive: true });
    sizeInput.addEventListener('touchcancel', () => { dragging = false; }, { passive: true });
  }

  if (symmetryInput) {
    symmetryInput.addEventListener('input', (e) => {
      const dt = window.drawingTool;
      if (!dt) return;
      const val = Math.max(1, Math.min(64, parseInt(e.target.value || '1', 10)));
      dt.symmetryAxes = val | 0;
    });

    // Drag horizontally to change symmetry value
    let symmetryDragging = false;
    let symmetryStartX = 0;
    let symmetryStartVal = 0;
    let symmetryDragTimeout = null;
    const symmetryPxPerUnit = 8; // drag sensitivity (less sensitive than brush size)
    
    symmetryInput.addEventListener('mousedown', (e) => {
      symmetryStartX = e.clientX;
      symmetryStartVal = parseInt(symmetryInput.value || '1', 10);
      
      // Delay drag initiation to allow normal click/focus behavior
      symmetryDragTimeout = setTimeout(() => {
        symmetryDragging = true;
        document.body.style.cursor = 'ew-resize';
      }, 150);
    });
    
    window.addEventListener('mousemove', (e) => {
      if (!symmetryDragging) {
        // Check if mouse has moved enough to start dragging immediately
        const deltaX = Math.abs(e.clientX - symmetryStartX);
        if (deltaX > 5 && symmetryDragTimeout) {
          clearTimeout(symmetryDragTimeout);
          symmetryDragging = true;
          document.body.style.cursor = 'ew-resize';
        } else {
          return;
        }
      }
      
      const delta = Math.round((e.clientX - symmetryStartX) / symmetryPxPerUnit);
      const next = Math.max(1, Math.min(64, symmetryStartVal + delta));
      if (next !== parseInt(symmetryInput.value || '1', 10)) {
        symmetryInput.value = String(next);
        symmetryInput.dispatchEvent(new Event('input'));
      }
    });
    
    window.addEventListener('mouseup', () => {
      // Clear timeout if it's still pending (was a quick click)
      if (symmetryDragTimeout) {
        clearTimeout(symmetryDragTimeout);
        symmetryDragTimeout = null;
      }
      
      if (!symmetryDragging) return;
      symmetryDragging = false;
      document.body.style.cursor = '';
    });

    // Touch drag for symmetry
    symmetryInput.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      symmetryDragging = true;
      symmetryStartX = t.clientX;
      symmetryStartVal = parseInt(symmetryInput.value || '1', 10);
    }, { passive: true });
    
    symmetryInput.addEventListener('touchmove', (e) => {
      if (!symmetryDragging) return;
      const t = e.touches[0];
      const delta = Math.round((t.clientX - symmetryStartX) / symmetryPxPerUnit);
      const next = Math.max(1, Math.min(64, symmetryStartVal + delta));
      if (next !== parseInt(symmetryInput.value || '1', 10)) {
        symmetryInput.value = String(next);
        symmetryInput.dispatchEvent(new Event('input'));
      }
    }, { passive: true });
    
    symmetryInput.addEventListener('touchend', () => { symmetryDragging = false; }, { passive: true });
    symmetryInput.addEventListener('touchcancel', () => { symmetryDragging = false; }, { passive: true });
  }

  // Stubs for undo/redo
  if (undoBtn) undoBtn.addEventListener('click', () => { if (window.drawingTool && window.drawingTool.undo) window.drawingTool.undo(); });
  if (redoBtn) redoBtn.addEventListener('click', () => { if (window.drawingTool && window.drawingTool.redo) window.drawingTool.redo(); });
}
