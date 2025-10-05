import WelcomeController from './WelcomeController.js';
import PageLoader from './PageLoader.js';
import FeatureFlagService from '../modules/features/FeatureFlagService.js';
import featureFlags from '../modules/features/config.js';
import DotField from '../modules/background/DotField.js';

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
    const flags = new FeatureFlagService(featureFlags);

    // Coming soon should have higher priority than welcome page and never show loader
    if (flags.isMobileRuntime() && flags.isEnabled('mobileComingSoon')) {
        // Redirect immediately to the app, where the mobile coming soon overlay is mounted
        try { window.location.replace('/app/'); } catch (_) { window.location.href = '/app/'; }
        return;
    }

    let loader = null;
    if (flags.isEnabled('loadingAnimation')) {
        loader = new PageLoader();
        loader.mount();
    }

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

    if (loader) {
        const coordinator = new LoadCoordinator({
            minMs: 2500,       // minimum time to let the pulse animation be visible
            maxMs: 5000,       // safety cap
            workPromises: [onWindowLoad, onFontsReady, onAssetsPreloaded],
        });
        coordinator.wait().then(() => loader.close());
    }

    // Mount background dot field behind welcome content
    try {
        const dots = new DotField({
            numDots: 1400,
            dotColor: 'rgb(255,255,255)',
            dotRadius: 1.1,
            repelRadius: 120,
            repelStrength: 0.1,
            restoringStrength: 0.025,
            friction: 0.92,
            backgroundColor: '#000000',
            colorFn: ({ x, y, width, height }) => {
                // Color like phyllotaxis: map angle around center to hue
                const cx = width * 0.5;
                const cy = height * 0.5;
                const dx = x - cx;
                const dy = y - cy;
                let angle = Math.atan2(dy, dx); // -PI..PI
                let hue = (angle * 180 / Math.PI);
                if (hue < 0) hue += 360;
                // Slight radial modulation for brightness
                const r = Math.hypot(dx, dy);
                const maxR = Math.hypot(cx, cy);
                const t = Math.min(1, r / (maxR * 0.85));
                const s = 0.75;
                const v = 0.9 - 0.2 * t;
                // HSV -> RGB
                const c = v * s;
                const hp = hue / 60;
                const xcol = c * (1 - Math.abs((hp % 2) - 1));
                let r1 = 0, g1 = 0, b1 = 0;
                if (hp >= 0 && hp < 1) { r1 = c; g1 = xcol; b1 = 0; }
                else if (hp < 2) { r1 = xcol; g1 = c; b1 = 0; }
                else if (hp < 3) { r1 = 0; g1 = c; b1 = xcol; }
                else if (hp < 4) { r1 = 0; g1 = xcol; b1 = c; }
                else if (hp < 5) { r1 = xcol; g1 = 0; b1 = c; }
                else { r1 = c; g1 = 0; b1 = xcol; }
                const m = v - c;
                const R = Math.round((r1 + m) * 255);
                const G = Math.round((g1 + m) * 255);
                const B = Math.round((b1 + m) * 255);
                return `rgb(${R},${G},${B})`;
            }
        });
        dots.mount();
        window._dotFieldWelcome = dots;
    } catch (_) {}

    // Handle "Open the app" button with page transition
    const openBtn = document.getElementById('openAppBtn');
    const overlay = document.querySelector('.page-transition');
    if (openBtn && overlay) {
        openBtn.addEventListener('click', (evt) => {
            evt.preventDefault();
            if (flags.isEnabled('pageTransition')) {
                try { overlay.classList.add('page-transition--active'); } catch (_) {}
            }
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
            // Navigate after the slide-in completes (match CSS duration 650ms) if enabled; otherwise navigate immediately
            if (flags.isEnabled('pageTransition')) {
                setTimeout(() => { window.location.href = target; }, 660);
            } else {
                window.location.href = target;
            }
        });
    }
});


