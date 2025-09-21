import FeatureFlagService from '../modules/features/FeatureFlagService.js';
import featureFlags from '../modules/features/config.js';

export default class WelcomeController {
	constructor() {
		this.flags = new FeatureFlagService(featureFlags);
	}

	init() {
		if (!this.flags.isEnabled('welcomePage')) {
			window.location.replace('/app/');
			return;
		}
	}
}


