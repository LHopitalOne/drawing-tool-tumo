// Canvas state persistence service: auto-saves and restores canvas state
class CanvasStateService {
  constructor() {
    this.storageKey = 'drawing-tool-canvas-state';
    this.metadataKey = 'drawing-tool-canvas-metadata';
    this.historyKey = 'drawing-tool-history';
    this.sessionKey = 'drawing-tool-session-id';
    this.autoSaveInterval = 30000; // Auto-save every 30 seconds
    this.autoSaveTimer = null;
    this.lastSaveTime = 0;
    this.minSaveInterval = 5000; // Minimum 5 seconds between saves to avoid excessive writes
    this.currentSessionId = this.generateSessionId();
    this.hasRestoredInSession = false; // Track if we've already restored in this session
  }

  /**
   * Generate a unique session ID
   * @returns {string}
   */
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start auto-save functionality
   * @param {Function} captureCallback - Function that returns canvas state data
   */
  startAutoSave(captureCallback) {
    if (!captureCallback || typeof captureCallback !== 'function') {
      console.warn('CanvasStateService: captureCallback must be a function');
      return;
    }

    this.captureCallback = captureCallback;

    // Auto-save on interval
    this.autoSaveTimer = setInterval(() => {
      this.save();
    }, this.autoSaveInterval);

    // Bind event handlers so we can remove them later
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        this.saveNow(); // Use saveNow for immediate save
      }
    };

    this.beforeUnloadHandler = () => {
      this.saveNow();
    };

    this.freezeHandler = () => {
      this.saveNow();
    };

    this.pageHideHandler = () => {
      this.saveNow();
    };

    // Save when page visibility changes (computer sleep, tab switch)
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    // Save before page unload
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    // Save on page freeze (mobile/background) - Page Lifecycle API
    window.addEventListener('freeze', this.freezeHandler);

    // Save when page is hidden (works on mobile Safari and others)
    window.addEventListener('pagehide', this.pageHideHandler);

    console.log('CanvasStateService: Auto-save started');
  }

  /**
   * Stop auto-save functionality
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Remove event listeners
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    if (this.freezeHandler) {
      window.removeEventListener('freeze', this.freezeHandler);
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
    }
  }

  /**
   * Save current canvas state to localStorage
   */
  save() {
    // Rate limiting to prevent excessive saves
    const now = Date.now();
    if (now - this.lastSaveTime < this.minSaveInterval) {
      return;
    }

    if (!this.captureCallback) {
      console.warn('CanvasStateService: No capture callback set');
      return;
    }

    try {
      const state = this.captureCallback();
      if (!state) {
        console.warn('CanvasStateService: Capture callback returned no state');
        return;
      }

      // Save canvas data as base64
      const canvasDataUrl = state.canvas.toDataURL('image/png');
      
      // Save metadata separately (smaller, faster to read)
      const metadata = {
        width: state.width,
        height: state.height,
        backgroundColor: state.backgroundColor,
        timestamp: now,
        sessionId: this.currentSessionId,
        version: '1.0'
      };

      // Save history if provided
      if (state.history) {
        try {
          const historyData = {
            history: this.serializeHistory(state.history),
            redoStack: this.serializeHistory(state.redoStack || [])
          };
          localStorage.setItem(this.historyKey, JSON.stringify(historyData));
        } catch (historyError) {
          console.warn('CanvasStateService: Failed to save history:', historyError);
          // Continue saving even if history fails
        }
      }

      localStorage.setItem(this.storageKey, canvasDataUrl);
      localStorage.setItem(this.metadataKey, JSON.stringify(metadata));
      localStorage.setItem(this.sessionKey, this.currentSessionId);
      
      this.lastSaveTime = now;
      console.log('CanvasStateService: State saved successfully');
    } catch (error) {
      console.error('CanvasStateService: Failed to save state:', error);
      // If localStorage is full, try to clear old data and retry
      if (error.name === 'QuotaExceededError') {
        this.clearSavedState();
      }
    }
  }

  /**
   * Check if saved state exists
   * @returns {boolean}
   */
  hasSavedState() {
    try {
      const metadata = localStorage.getItem(this.metadataKey);
      const data = localStorage.getItem(this.storageKey);
      return !!(metadata && data);
    } catch (error) {
      console.error('CanvasStateService: Failed to check saved state:', error);
      return false;
    }
  }

  /**
   * Check if we're in the same session (page wasn't reloaded)
   * @returns {boolean}
   */
  isSameSession() {
    try {
      if (!this.hasSavedState()) {
        return false;
      }

      const savedSessionId = localStorage.getItem(this.sessionKey);
      
      // If saved session matches current session, we're resuming same session
      // This happens when computer sleeps and wakes up or page is suspended
      return savedSessionId === this.currentSessionId;
    } catch (error) {
      console.error('CanvasStateService: Failed to check session:', error);
      return false;
    }
  }

  /**
   * Check if we should offer to restore saved state
   * Returns false if we're in the same session (page wasn't actually reloaded)
   * or if we've already restored in this session
   * @returns {boolean}
   */
  shouldOfferRestore() {
    try {
      if (!this.hasSavedState()) {
        return false;
      }

      if (this.hasRestoredInSession) {
        return false;
      }

      // Don't offer restore if we're in the same session
      if (this.isSameSession()) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('CanvasStateService: Failed to check if should restore:', error);
      return false;
    }
  }

  /**
   * Get metadata about saved state
   * @returns {Object|null}
   */
  getSavedMetadata() {
    try {
      const metadataStr = localStorage.getItem(this.metadataKey);
      if (!metadataStr) return null;
      return JSON.parse(metadataStr);
    } catch (error) {
      console.error('CanvasStateService: Failed to read metadata:', error);
      return null;
    }
  }

  /**
   * Restore canvas state from localStorage
   * @returns {Promise<Object|null>} Promise that resolves to state object or null
   */
  async restore() {
    try {
      const metadataStr = localStorage.getItem(this.metadataKey);
      const dataUrl = localStorage.getItem(this.storageKey);

      if (!metadataStr || !dataUrl) {
        console.log('CanvasStateService: No saved state found');
        return null;
      }

      const metadata = JSON.parse(metadataStr);
      
      // Load image from data URL
      const img = await this.loadImage(dataUrl);

      // Load history if available
      let history = null;
      let redoStack = null;
      try {
        const historyDataStr = localStorage.getItem(this.historyKey);
        if (historyDataStr) {
          const historyData = JSON.parse(historyDataStr);
          history = await this.deserializeHistory(historyData.history || []);
          redoStack = await this.deserializeHistory(historyData.redoStack || []);
        }
      } catch (historyError) {
        console.warn('CanvasStateService: Failed to restore history:', historyError);
        // Continue without history if it fails to load
      }

      // Mark that we've restored in this session
      this.hasRestoredInSession = true;

      console.log('CanvasStateService: State restored successfully');
      return {
        image: img,
        metadata: metadata,
        history: history,
        redoStack: redoStack
      };
    } catch (error) {
      console.error('CanvasStateService: Failed to restore state:', error);
      return null;
    }
  }

  /**
   * Load image from data URL
   * @param {string} dataUrl
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Serialize history stack (ImageData objects) to JSON-compatible format
   * @param {Array} historyStack - Array of ImageData or Canvas objects
   * @returns {Array}
   */
  serializeHistory(historyStack) {
    if (!Array.isArray(historyStack)) return [];
    
    return historyStack.map(item => {
      if (!item) return null;
      
      if (item instanceof ImageData) {
        // Create a temporary canvas to convert ImageData to base64
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = item.width;
        tempCanvas.height = item.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.putImageData(item, 0, 0);
        return {
          type: 'imageData',
          width: item.width,
          height: item.height,
          data: tempCanvas.toDataURL('image/png')
        };
      } else if (item instanceof HTMLCanvasElement) {
        return {
          type: 'canvas',
          width: item.width,
          height: item.height,
          data: item.toDataURL('image/png')
        };
      }
      return null;
    }).filter(item => item !== null);
  }

  /**
   * Deserialize history stack from JSON format back to ImageData objects
   * @param {Array} serializedHistory
   * @returns {Promise<Array>}
   */
  async deserializeHistory(serializedHistory) {
    if (!Array.isArray(serializedHistory)) return [];
    
    const promises = serializedHistory.map(async item => {
      if (!item || !item.data) return null;
      
      try {
        const img = await this.loadImage(item.data);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = item.width;
        tempCanvas.height = item.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Return as ImageData to match the original format
        return ctx.getImageData(0, 0, item.width, item.height);
      } catch (error) {
        console.warn('Failed to deserialize history item:', error);
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    return results.filter(item => item !== null);
  }

  /**
   * Clear saved state from localStorage
   */
  clearSavedState() {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.metadataKey);
      localStorage.removeItem(this.historyKey);
      localStorage.removeItem(this.sessionKey);
      console.log('CanvasStateService: Saved state cleared');
    } catch (error) {
      console.error('CanvasStateService: Failed to clear state:', error);
    }
  }

  /**
   * Manual save trigger (for critical moments like after major operations)
   */
  saveNow() {
    const originalMinInterval = this.minSaveInterval;
    this.minSaveInterval = 0; // Bypass rate limiting
    this.save();
    this.minSaveInterval = originalMinInterval;
  }
}

export default CanvasStateService;

