import WelcomeController from './WelcomeController.js';
import PageLoader from './PageLoader.js';

document.addEventListener('DOMContentLoaded', () => {
	const loader = new PageLoader();
	loader.mount();

	const controller = new WelcomeController();
	controller.init();

	// Welcome page: close 2.5s after natural load (fixed wait)
	window.addEventListener('load', () => {
		setTimeout(() => loader.close(), 2500);
	});
});


