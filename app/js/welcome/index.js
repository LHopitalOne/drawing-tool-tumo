import WelcomeController from './WelcomeController.js';
import PageLoader from './PageLoader.js';

class LoadCoordinator {
    constructor({ minMs = 1200, maxMs = 5000, workPromises = [] } = {}) {
        this.minMs = minMs;
        this.maxMs = maxMs;
        this.workPromises = workPromises;
    }

    wait() {
        const minTimer = new Promise((resolve) => setTimeout(resolve, this.minMs));
        const work = this.workPromises.length ? Promise.all(this.workPromises) : Promise.resolve();
        const gate = Promise.all([minTimer, work]);
        if (typeof this.maxMs === 'number' && this.maxMs > 0) {
            const maxTimer = new Promise((resolve) => setTimeout(resolve, this.maxMs));
            return Promise.race([gate, maxTimer]);
        }
        return gate;
    }
}

function preloadImages(urls = []) {
    return Promise.all(urls.map((url) => new Promise((resolve) => {
        try {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
        } catch (_) { resolve(); }
    })));
}

document.addEventListener('DOMContentLoaded', () => {
    const loader = new PageLoader();
    loader.mount();

    const controller = new WelcomeController();
    controller.init();

    // Real loading coordination: ensure animation shows while real work proceeds
    const assetBase = 'app/graphics/';
    const assets = [
        'brush_not-selected.svg',
        'brush_selected.svg',
        'pen_not-selected.svg',
        'pen_selected.svg',
        'pencil_not-selected.svg',
        'pencil_selected.svg',
        'spray_not-selected.svg',
        'spray_selected.svg',
        'fountain_not-selected.svg',
        'fountain_selected.svg',
        'eraser_not-selected.svg',
        'eraser_selected.svg',
    ].map((f) => assetBase + f);

    const onWindowLoad = new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    const onFontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    const onAssetsPreloaded = preloadImages(assets);

    const coordinator = new LoadCoordinator({
        minMs: 2500,       // minimum time to let the pulse animation be visible
        maxMs: 5000,       // safety cap
        workPromises: [onWindowLoad, onFontsReady, onAssetsPreloaded],
    });

    coordinator.wait().then(() => loader.close());

    // Handle "Open the app" button with page transition
    const openBtn = document.getElementById('openAppBtn');
    const overlay = document.querySelector('.page-transition');
    if (openBtn && overlay) {
        openBtn.addEventListener('click', (evt) => {
            evt.preventDefault();
            try { overlay.classList.add('page-transition--active'); } catch (_) {}
            // Build a robust URL to the app directory, ensuring trailing slash so relative assets resolve
            let target;
            try {
                const url = new URL('./app/', window.location.href);
                // Preserve query and hash if present
                if (window.location.search) { url.search = window.location.search; }
                if (window.location.hash) { url.hash = window.location.hash; }
                target = url.href;
            } catch (_) {
                // Fallback
                const base = window.location.pathname.replace(/\/$/, '') + '/app/';
                target = base + window.location.search + window.location.hash;
            }
            // Navigate after the slide-in completes (match CSS duration 650ms)
            setTimeout(() => { window.location.href = target; }, 660);
        });
    }
});


