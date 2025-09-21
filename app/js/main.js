import './modules/ui/brushUI.js';
import App from './modules/App.js';
import PageLoader from '../js/welcome/PageLoader.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loader = new PageLoader();
  loader.mount();

  const app = new App();
  app.init();

  window.addEventListener('load', () => {
    loader.close();
  });
});
