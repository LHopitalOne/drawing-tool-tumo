import './modules/ui/brushUI.js';
import App from './modules/App.js';
import PageLoader from '../js/welcome/PageLoader.js';
import DotField from './modules/background/DotField.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loader = new PageLoader();
  loader.mount();

  const app = new App();
  app.init();

  window.addEventListener('load', () => {
    setTimeout(() => loader.close(), 2500);
  });

  // Mount background dot field once app is initialized
  try {
    const dots = new DotField({
      numDots: 1400,
      dotColor: 'rgb(255,255,255)',
      dotRadius: 1.1,
      repelRadius: 120,
      repelStrength: 0.1,
      restoringStrength: 0.025,
      friction: 0.92,
    });
    dots.mount();
    window._dotField = dots;
  } catch (_) {}
});
