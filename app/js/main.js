import './modules/ui/brushUI.js';
import App from './modules/App.js';
import PageLoader from '../js/welcome/PageLoader.js';
import FeatureFlagService from './modules/features/FeatureFlagService.js';
import featureFlags from './modules/features/config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const flags = new FeatureFlagService(featureFlags);
  const isMobileComingSoon = flags.isMobileRuntime() && flags.isEnabled('mobileComingSoon');

  // If mobile coming soon is active, do NOT show a page loader at all
  let loader = null;
  if (isMobileComingSoon) {
    try { const existing = document.querySelector('.page-loader'); if (existing) existing.remove(); } catch (_) {}
  } else if (flags.isEnabled('loadingAnimation')) {
    loader = new PageLoader();
    loader.mount();
  } else {
    // Remove any static loader markup present in HTML when disabled
    try {
      const existing = document.querySelector('.page-loader');
      if (existing) existing.remove();
    } catch (_) {}
  }

  const app = new App();
  app.init();

  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => loader.close(), 2500);
    });
  }
});
