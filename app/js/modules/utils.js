// Utility functions shared across the drawing tool application

/**
 * Convert hex color to RGB components
 * @param {string} hex - Hex color string (e.g., '#ffffff' or 'fff')
 * @returns {Object} - Object with r, g, b properties (0-255)
 */
export function hexToRgb(hex) {
  let c = (hex || '#ffffff').replace('#', '');
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, v };
}

export function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

/**
 * Create a seeded random number generator for consistent results
 * @param {number} seed - Seed value for randomization
 * @returns {Function} - Random function that returns values between 0 and 1
 */
export function createSeededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return function() {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

/**
 * Generate a unique identifier
 * @returns {string} - UUID string
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculate distance between two points
 * @param {number} x0 - First point x coordinate
 * @param {number} y0 - First point y coordinate
 * @param {number} x1 - Second point x coordinate
 * @param {number} y1 - Second point y coordinate
 * @returns {number} - Distance between points
 */
export function distance(x0, y0, x1, y1) {
  return Math.hypot(x1 - x0, y1 - y0);
}

/**
 * Parse SVG path data and convert to canvas drawing commands
 * @param {string} pathData - SVG path data string
 * @returns {Array} - Array of drawing commands
 */
function parseSVGPath(pathData) {
  const commands = [];
  const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match;
  
  while ((match = regex.exec(pathData)) !== null) {
    const command = match[1];
    const params = match[2].trim().split(/[\s,]+/).filter(p => p).map(Number);
    commands.push({ command, params });
  }
  
  return commands;
}

/**
 * Execute canvas drawing commands from parsed SVG path
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} commands - Array of drawing commands
 * @param {number} scale - Scale factor for the path
 */
function executePathCommands(ctx, commands, scale = 1) {
  let currentX = 0, currentY = 0;
  let pathStartX = 0, pathStartY = 0;
  
  ctx.beginPath();
  
  for (const { command, params } of commands) {
    switch (command.toLowerCase()) {
      case 'm': // moveTo
        if (command === 'M') {
          currentX = params[0] * scale;
          currentY = params[1] * scale;
        } else {
          currentX += params[0] * scale;
          currentY += params[1] * scale;
        }
        ctx.moveTo(currentX, currentY);
        pathStartX = currentX;
        pathStartY = currentY;
        break;
        
      case 'l': // lineTo
        if (command === 'L') {
          currentX = params[0] * scale;
          currentY = params[1] * scale;
        } else {
          currentX += params[0] * scale;
          currentY += params[1] * scale;
        }
        ctx.lineTo(currentX, currentY);
        break;
        
      case 'h': // horizontal lineTo
        if (command === 'H') {
          currentX = params[0] * scale;
        } else {
          currentX += params[0] * scale;
        }
        ctx.lineTo(currentX, currentY);
        break;
        
      case 'v': // vertical lineTo
        if (command === 'V') {
          currentY = params[0] * scale;
        } else {
          currentY += params[0] * scale;
        }
        ctx.lineTo(currentX, currentY);
        break;
        
      case 'c': // curveTo
        if (command === 'C') {
          ctx.bezierCurveTo(
            params[0] * scale, params[1] * scale,
            params[2] * scale, params[3] * scale,
            params[4] * scale, params[5] * scale
          );
          currentX = params[4] * scale;
          currentY = params[5] * scale;
        } else {
          ctx.bezierCurveTo(
            currentX + params[0] * scale, currentY + params[1] * scale,
            currentX + params[2] * scale, currentY + params[3] * scale,
            currentX + params[4] * scale, currentY + params[5] * scale
          );
          currentX += params[4] * scale;
          currentY += params[5] * scale;
        }
        break;
        
      case 'q': // quadratic curveTo
        if (command === 'Q') {
          ctx.quadraticCurveTo(
            params[0] * scale, params[1] * scale,
            params[2] * scale, params[3] * scale
          );
          currentX = params[2] * scale;
          currentY = params[3] * scale;
        } else {
          ctx.quadraticCurveTo(
            currentX + params[0] * scale, currentY + params[1] * scale,
            currentX + params[2] * scale, currentY + params[3] * scale
          );
          currentX += params[2] * scale;
          currentY += params[3] * scale;
        }
        break;
        
      case 'a': // arc
        // Arc implementation is complex, for now we'll approximate with lineTo
        if (command === 'A') {
          currentX = params[5] * scale;
          currentY = params[6] * scale;
        } else {
          currentX += params[5] * scale;
          currentY += params[6] * scale;
        }
        ctx.lineTo(currentX, currentY);
        break;
        
      case 'z': // closePath
        ctx.closePath();
        currentX = pathStartX;
        currentY = pathStartY;
        break;
    }
  }
}

/**
 * Parse transformation string into matrix values
 * @param {string} transform - Transform attribute string
 * @returns {Object} - Transformation object with translate, scale, rotate
 */
function parseTransform(transform) {
  const result = {
    translateX: 0,
    translateY: 0,
    scaleX: 1,
    scaleY: 1,
    rotate: 0
  };
  
  if (!transform) return result;
  
  // Parse translate(x, y) or translate(x y)
  const translateMatch = transform.match(/translate\(([^)]+)\)/);
  if (translateMatch) {
    const values = translateMatch[1].trim().split(/[\s,]+/).map(Number);
    result.translateX = values[0] || 0;
    result.translateY = values[1] || values[0] || 0;
  }
  
  // Parse scale(x, y) or scale(s)
  const scaleMatch = transform.match(/scale\(([^)]+)\)/);
  if (scaleMatch) {
    const values = scaleMatch[1].trim().split(/[\s,]+/).map(Number);
    result.scaleX = values[0] || 1;
    result.scaleY = values[1] || values[0] || 1;
  }
  
  // Parse rotate(angle)
  const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
  if (rotateMatch) {
    result.rotate = Number(rotateMatch[1].trim()) || 0;
  }
  
  return result;
}

/**
 * Apply transformation to canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} transform - Transformation object
 */
function applyTransform(ctx, transform) {
  // Apply translate
  ctx.translate(transform.translateX, transform.translateY);
  
  // Apply rotation (convert degrees to radians)
  if (transform.rotate) {
    ctx.rotate((transform.rotate * Math.PI) / 180);
  }
  
  // Apply scale
  ctx.scale(transform.scaleX, transform.scaleY);
}

/**
 * Parse SVG string and extract elements
 * @param {string} svgString - Complete SVG string
 * @returns {Object} - Object with paths, uses, and defs
 */
function parseSVGElements(svgString) {
  const result = {
    paths: [],
    uses: [],
    defs: {}
  };
  
  // Extract path elements
  const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
  let match;
  while ((match = pathRegex.exec(svgString)) !== null) {
    result.paths.push({
      d: match[1],
      transform: null
    });
  }
  
  // Extract use elements (more flexible attribute order)
  const useRegex = /<use[^>]*>/g;
  while ((match = useRegex.exec(svgString)) !== null) {
    const useElement = match[0];
    
    // Extract href
    const hrefMatch = useElement.match(/xlink:href="([^"]*)"/);
    if (!hrefMatch) continue;
    
    // Extract transform
    const transformMatch = useElement.match(/transform="([^"]*)"/);
    const transformString = transformMatch ? transformMatch[1] : '';
    
    result.uses.push({
      href: hrefMatch[1],
      transform: parseTransform(transformString)
    });
  }
  
  // Extract defs section and referenced elements
  const defsMatch = svgString.match(/<defs>(.*?)<\/defs>/s);
  if (defsMatch) {
    const defsContent = defsMatch[1];
    
    // Find groups with IDs in defs
    const groupRegex = /<g[^>]*id="([^"]*)"[^>]*>(.*?)<\/g>/gs;
    let groupMatch;
    while ((groupMatch = groupRegex.exec(defsContent)) !== null) {
      const groupId = groupMatch[1];
      const groupContent = groupMatch[2];
      
      // Extract paths within this group
      const groupPaths = [];
      const groupPathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
      let pathMatch;
      while ((pathMatch = groupPathRegex.exec(groupContent)) !== null) {
        groupPaths.push({
          d: pathMatch[1],
          transform: null
        });
      }
      
      result.defs[`#${groupId}`] = groupPaths;
    }
  }
  
  return result;
}

/**
 * Embed SVG content into canvas using drawing functions
 * @param {CanvasRenderingContext2D} ctx - Canvas context to draw on
 * @param {string} svgString - SVG string content
 * @param {number} x - X position to draw at
 * @param {number} y - Y position to draw at
 * @param {number} width - Target width for the SVG
 * @param {number} height - Target height for the SVG
 * @param {string} fillColor - Fill color for the paths
 */
export function embedSVG(ctx, svgString, x = 0, y = 0, width = 100, height = 100, fillColor = '#000000') {
  ctx.save();
  
  // Extract viewBox from SVG to determine original dimensions
  const viewBoxMatch = svgString.match(/viewBox="([^"]*)"/);
  let originalWidth = 100, originalHeight = 100;
  
  if (viewBoxMatch) {
    const viewBox = viewBoxMatch[1].split(/\s+/).map(Number);
    originalWidth = viewBox[2] - viewBox[0];
    originalHeight = viewBox[3] - viewBox[1];
  } else {
    // Try to extract width/height attributes
    const widthMatch = svgString.match(/width="([^"]*)"/) || svgString.match(/width=([^\s>]*)/);
    const heightMatch = svgString.match(/height="([^"]*)"/) || svgString.match(/height=([^\s>]*)/);
    
    if (widthMatch) originalWidth = parseFloat(widthMatch[1]);
    if (heightMatch) originalHeight = parseFloat(heightMatch[1]);
  }
  
  // Calculate scale to fit target dimensions
  const scaleX = width / originalWidth;
  const scaleY = height / originalHeight;
  const baseScale = Math.min(scaleX, scaleY);
  
  // Position and scale
  ctx.translate(x, y);
  ctx.scale(baseScale, baseScale);
  
  // Set fill color
  ctx.fillStyle = fillColor;
  
  // Parse all SVG elements
  const elements = parseSVGElements(svgString);
  
  // Debug logging (can be removed later)
  console.log('Parsed SVG elements:', {
    paths: elements.paths.length,
    uses: elements.uses.length,
    defs: Object.keys(elements.defs).length
  });
  
  // Draw direct path elements first
  for (const pathElement of elements.paths) {
    const commands = parseSVGPath(pathElement.d);
    executePathCommands(ctx, commands);
    ctx.fill();
  }
  
  // Draw use elements with their transformations
  for (const useElement of elements.uses) {
    const referencedPaths = elements.defs[useElement.href];
    if (referencedPaths) {
      ctx.save();
      
      // Apply the transformation from the use element
      applyTransform(ctx, useElement.transform);
      
      // Draw all paths from the referenced group
      for (const pathElement of referencedPaths) {
        const commands = parseSVGPath(pathElement.d);
        executePathCommands(ctx, commands);
        ctx.fill();
      }
      
      ctx.restore();
    }
  }
  
  ctx.restore();
}