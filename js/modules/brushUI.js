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

// Focus (long-hover) state
const focusState = {
  active: false,
  anchorBtn: null,
  sizeEl: null,
  colorEl: null,
  timerId: null,
  dwellMs: 500,
  config: { buttonSize: 56, distance: 72 },
};

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

function ensureFocusControls(group) {
  let sizeEl = group.querySelector('.focus-size');
  let colorEl = group.querySelector('.focus-color');
  if (!sizeEl) {
    sizeEl = document.createElement('div');
    sizeEl.className = 'focus-circle focus-size';
    sizeEl.innerHTML = '<div class="focus-size-inner"></div><div class="focus-size-label"></div>';
    group.appendChild(sizeEl);
  }
  if (!colorEl) {
    colorEl = document.createElement('div');
    colorEl.className = 'focus-circle focus-color';
    colorEl.innerHTML = '<div class="focus-color-dot"></div>';
    group.appendChild(colorEl);
  }
  return { sizeEl, colorEl };
}

function positionFocusCircles(anchorBtn, sizeEl, colorEl) {
  const angle = anchorBtn.style.getPropertyValue('--angle') || '0deg';
  const baseDist = parseFloat((anchorBtn.style.getPropertyValue('--distance') || '72px').replace('px','')) || focusState.config.distance;
  const btnSize = parseFloat((anchorBtn.style.width || '56px').replace('px','')) || focusState.config.buttonSize;

  const sizeDist = baseDist + btnSize * 1.2;
  const colorDist = baseDist + btnSize * 2.2;

  // Bifork: offset perpendicular in opposite directions
  const side = Math.round(btnSize * 0.35);

  [sizeEl, colorEl].forEach(el => {
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.setProperty('--angle', angle);
  });
  sizeEl.style.setProperty('--distance', `${sizeDist}px`);
  sizeEl.style.setProperty('--side', `${side}px`);

  colorEl.style.setProperty('--distance', `${colorDist}px`);
  colorEl.style.setProperty('--side', `${-side}px`);
}

function enterFocus(anchorBtn) {
  if (!anchorBtn || focusState.active) return;
  const group = document.querySelector('.brush-group');
  if (!group) return;
  focusState.active = true;
  focusState.anchorBtn = anchorBtn;
  const { sizeEl, colorEl } = ensureFocusControls(group);
  focusState.sizeEl = sizeEl;
  focusState.colorEl = colorEl;

  // Hide other buttons
  group.querySelectorAll('.brush-btn').forEach(btn => {
    if (btn !== anchorBtn) btn.style.visibility = 'hidden';
  });

  // Position and show controls
  positionFocusCircles(anchorBtn, sizeEl, colorEl);
  sizeEl.style.display = 'flex';
  colorEl.style.display = 'flex';

  // Select this brush
  const key = anchorBtn.getAttribute('data-brush');
  document.dispatchEvent(new CustomEvent('brush:select', { detail: { key } }));

  // Initialize size label and inner preview
  const label = sizeEl.querySelector('.focus-size-label');
  const inner = sizeEl.querySelector('.focus-size-inner');
  try {
    const currentSize = window.drawingTool && window.drawingTool.getBrushSettings ? window.drawingTool.getBrushSettings(key).size : 10;
    label.textContent = String(currentSize);
    const diameter = Math.max(8, Math.min(46, currentSize));
    inner.style.width = `${diameter}px`;
    inner.style.height = `${diameter}px`;
  } catch(_) {}

  // Color dot
  const colorDot = colorEl.querySelector('.focus-color-dot');
  const colorInput = document.getElementById('brushColorInput');
  const color = (colorInput && colorInput.value) || '#ffffff';
  colorDot.style.background = color;

  // Bind size drag
  bindSizeDrag(sizeEl, anchorBtn);
}

function exitFocus() {
  if (!focusState.active) return;
  const group = document.querySelector('.brush-group');
  if (group) {
    group.querySelectorAll('.brush-btn').forEach(btn => { btn.style.visibility = 'visible'; });
  }
  if (focusState.sizeEl) focusState.sizeEl.style.display = 'none';
  if (focusState.colorEl) focusState.colorEl.style.display = 'none';
  focusState.active = false;
  focusState.anchorBtn = null;
  document.dispatchEvent(new CustomEvent('brush:focus-exit'));
}

function bindSizeDrag(sizeEl, anchorBtn) {
  // Use pointer events
  const group = document.querySelector('.brush-group');
  if (!group) return;

  let dragging = false;
  let startSize = 0;
  let startClientY = 0;

  const onPointerDown = (e) => {
    e.preventDefault();
    sizeEl.setPointerCapture && sizeEl.setPointerCapture(e.pointerId);
    dragging = true;
    startClientY = e.clientY;
    startSize = (window.drawingTool && window.drawingTool.brushRadius) ? window.drawingTool.brushRadius : 10;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dy = startClientY - e.clientY; // up = positive
    const next = clamp(Math.round(startSize + dy), 1, 400);

    // Update label/preview
    const label = sizeEl.querySelector('.focus-size-label');
    const inner = sizeEl.querySelector('.focus-size-inner');
    label.textContent = String(next);
    const diameter = Math.max(8, Math.min(46, next));
    inner.style.width = `${diameter}px`;
    inner.style.height = `${diameter}px`;

    // Dispatch size change event for drawingTool to handle
    const evt = new CustomEvent('brush:size-change', { detail: { size: next } });
    document.dispatchEvent(evt);
  };

  const onPointerUp = (e) => {
    dragging = false;
    sizeEl.releasePointerCapture && sizeEl.releasePointerCapture(e.pointerId);
    window.removeEventListener('pointermove', onPointerMove);
  };

  sizeEl.addEventListener('pointerdown', onPointerDown);
}

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

  // Save config for focus calculations
  focusState.config = { buttonSize, distance };

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

    // If focus is active, keep anchor and focus circles visible, ignore hover changes
    if (focusState.active && focusState.anchorBtn) {
      nodes.forEach((node) => {
        const key = node.getAttribute('data-brush');
        const isActive = Boolean(activeKey && activeKey === key);
        node.style.visibility = (focusState.anchorBtn === node) ? 'visible' : 'hidden';
        updateNodeIcon(node, isActive);
      });
      if (focusState.sizeEl) focusState.sizeEl.style.display = 'flex';
      if (focusState.colorEl) focusState.colorEl.style.display = 'flex';
      return;
    }

    nodes.forEach((node) => {
      const key = node.getAttribute('data-brush');
      const isActive = Boolean(activeKey && activeKey === key);
      const isHover = Boolean(hoverEl && hoverEl === node);
      if (isActive) node.classList.add('selected'); else node.classList.remove('selected');
      // If focus is active, keep only anchor visible
      if (focusState.active) {
        node.style.visibility = (focusState.anchorBtn === node) ? 'visible' : 'hidden';
      } else {
        node.style.visibility = 'visible';
      }
      updateNodeIcon(node, isActive || isHover);
    });

    // Manage dwell timer for focus activation
    if (focusState.timerId) { clearTimeout(focusState.timerId); focusState.timerId = null; }
    if (hoverEl && !focusState.active) {
      focusState.timerId = setTimeout(() => { enterFocus(hoverEl); }, focusState.dwellMs);
    }

    _prevHoverEl = hoverEl || null;
    _prevActiveKey = activeKey || null;
  };
  window.brushRing.preloadPromise = Promise.resolve();
  window.brushRing.exitFocus = () => exitFocus();
  window.brushRing.isFocusActive = () => Boolean(focusState.active);
  window.brushRing.updateFocusColor = (color) => {
    if (!focusState.active || !focusState.colorEl) return;
    const dot = focusState.colorEl.querySelector('.focus-color-dot');
    if (dot) dot.style.background = color;
  };

  // Prevent clicks inside focus circles from bubbling in ways that might close the panel
  document.addEventListener('pointerdown', (e) => {
    if (!focusState.active) return;
    const target = e.target;
    const group = document.querySelector('.brush-group');
    if (!group) return;
    if (group.contains(target)) {
      e.stopPropagation();
    }
  });
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
});

export default initBrushRing;
