import WelcomeController from './WelcomeController.js';
import PageLoader from './PageLoader.js';

document.addEventListener('DOMContentLoaded', () => {
	const loader = new PageLoader();
	loader.mount();

	const controller = new WelcomeController();
	controller.init();

	// Simulate quick readiness; in real app tie to actual async readiness
	window.addEventListener('load', () => {
		setTimeout(() => loader.unmount(), 30000);
	});
});


