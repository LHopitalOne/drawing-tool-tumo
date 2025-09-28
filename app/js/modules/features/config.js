// Central feature flags configuration
// Toggle flags here; consumed by App via FeatureFlagService

export const featureFlags = {
  mobileComingSoon: true,
  welcomePage: true,
  // Controls the slide-in transition overlay when navigating between pages
  pageTransition: false,
  // Global loading animation flag (applies across pages)
  loadingAnimation: false,
};

export default featureFlags;


