// Simple feature flag service with user-agent helpers

export class FeatureFlagService {
  constructor(initialFlags = {}) {
    this.flags = { ...initialFlags };
  }

  isEnabled(flagKey) {
    return Boolean(this.flags && this.flags[flagKey]);
  }

  enable(flagKey) {
    this.flags[flagKey] = true;
  }

  disable(flagKey) {
    this.flags[flagKey] = false;
  }

  isMobileUserAgent(uaString) {
    if (!uaString || typeof uaString !== 'string') return false;
    // Broad mobile/tablet detection via UA
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(uaString);
  }

  isMobileRuntime() {
    try {
      return this.isMobileUserAgent(navigator.userAgent || '');
    } catch (_) {
      return false;
    }
  }
}

export default FeatureFlagService;


