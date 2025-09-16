// App bootstrap: wires controllers and main tool
import DrawingTool from './drawingTool.js';
import FeatureFlagService from './features/FeatureFlagService.js';
import featureFlags from './features/config.js';
import MobileComingSoonView from './features/views/MobileComingSoonView.js';

class App {
  constructor() {
    this.tool = null;
    this.flags = new FeatureFlagService(featureFlags);
    this.mobileOverlay = null;
  }

  init() {
    // If mobile coming soon is enabled and UA is mobile, show overlay and skip app init
    const isMobile = this.flags.isMobileRuntime();
    if (isMobile && this.flags.isEnabled('mobileComingSoon')) {
      this.mobileOverlay = new MobileComingSoonView();
      this.mobileOverlay.mount();
      try { window.app = this; } catch(_) {}
      return;
    }

    this.tool = new DrawingTool();
    try { window.app = this; } catch(_) {}
  }
}

export default App;

