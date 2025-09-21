import PhyllotaxisField from '../modules/features/components/PhyllotaxisField.js';

export default class PageLoader {
	constructor() {
		this.root = null;
		this.field = null;
		this._pulseTimer = null;
		this._expanded = true;
		this.textEl = null;
		this._textTimer = null;
		this._isClosing = false;
	}

	mount() {
		if (this.root) return;
		let root = document.querySelector('.page-loader');
		let content;
		if (root) {
			content = root.querySelector('.page-loader__content') || root;
		} else {
			root = document.createElement('div');
			root.className = 'page-loader';
			content = document.createElement('div');
			content.className = 'page-loader__content';
		}
		const screenWidth = window.innerWidth || document.documentElement.clientWidth || 500;
		const size = Math.round(screenWidth * 0.15);
		const field = new PhyllotaxisField({ width: size, height: size, className: 'page-loader__phyllo' });
		// Insert phyllotaxis before text if content already has text
		const existingText = content.querySelector('.page-loader__text');
		if (existingText) {
			content.insertBefore(field.el(), existingText);
			this.textEl = existingText;
		} else {
			content.appendChild(field.el());
			const text = document.createElement('div');
			text.className = 'page-loader__text';
			text.textContent = 'The page is loading. Please wait…';
			content.appendChild(text);
			this.textEl = text;
		}
		if (!document.body.contains(root)) {
			root.appendChild(content);
			document.body.appendChild(root);
		}
		this.root = root;
		this.field = field;
		// Defer render until in DOM so measurements are correct
		requestAnimationFrame(() => {
			field.render();
			setTimeout(() => this._startPulse(), 900);
			// Delay message reveal by 2s
			this._textTimer = setTimeout(() => {
				try { this.root.classList.add('page-loader--show-text'); } catch (_) {}
			}, 2000);
		});
	}

	unmount() {
		if (!this.root) return;
		if (this._pulseTimer) { try { clearTimeout(this._pulseTimer); } catch (_) {} this._pulseTimer = null; }
		if (this._textTimer) { try { clearTimeout(this._textTimer); } catch (_) {} this._textTimer = null; }
		try { this.root.remove(); } catch (_) {}
		this.root = null;
		this.field = null;
		this.textEl = null;
	}

	close() {
		if (this._isClosing) return;
		this._isClosing = true;
		if (this._pulseTimer) { try { clearTimeout(this._pulseTimer); } catch (_) {} this._pulseTimer = null; }
		const fieldEl = this.field && this.field.el ? this.field.el() : this.root;
		if (!fieldEl) { this.unmount(); return; }
		const dots = Array.from(fieldEl.querySelectorAll('.phyllo-dot'));
		let maxRing = 0;
		dots.forEach((d) => { const r = parseInt(d.dataset.ring || '0', 10) || 0; if (r > maxRing) maxRing = r; });

		// 1) Fade out text
		try { if (this.textEl) { this.textEl.style.transition = 'opacity 260ms ease'; this.textEl.style.opacity = '0'; } } catch (_) {}

		// 2) Brief expand beyond 100%
		const expandDuration = 520; // longer to contribute to ~2.5s total on welcome
		dots.forEach((dot) => {
			const dx = parseFloat(dot.dataset.dx || '0') || 0;
			const dy = parseFloat(dot.dataset.dy || '0') || 0;
			dot.style.transition = `transform ${expandDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
			dot.style.transform = `translate(-50%, -50%) translate(${dx * 2}px, ${dy * 2}px) rotate(22deg) scale(1)`;
		});

		// 3) Collapse to center, edges first → center
		const collapseDuration = 700;
		const ringDelayMs = 38;
		setTimeout(() => {
			dots.forEach((dot) => {
				const ringIndex = parseInt(dot.dataset.ring || '0', 10) || 0;
				const delay = (maxRing - ringIndex) * ringDelayMs;
				setTimeout(() => {
					dot.style.transition = `transform ${collapseDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
					dot.style.transform = 'translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(0.5)';
				}, delay);
			});
		}, expandDuration + 40);

		const total = expandDuration + 40 + collapseDuration + ringDelayMs * maxRing + 60;
		setTimeout(() => {
			try {
				this.root.classList.add('page-loader--slide-out');
				this.root.addEventListener('transitionend', () => this.unmount(), { once: true });
			} catch (_) {
				this.unmount();
			}
		}, total);
	}

	_startPulse() {
		const fieldEl = this.field && this.field.el ? this.field.el() : this.root;
		if (!fieldEl) return;
		const dots = Array.from(fieldEl.querySelectorAll('.phyllo-dot'));
		if (dots.length === 0) return;
		let maxRing = 0;
		dots.forEach((d) => { const r = parseInt(d.dataset.ring || '0', 10) || 0; if (r > maxRing) maxRing = r; });

		const durationMs = 650;
		const ringDelayMs = 42;
		const factor = this._expanded ? 0.8 : 1.0;
		const centerOut = this._expanded;

		// Sync text opacity with phase (smooth fade over full phase)
		try {
			if (this.textEl && this.root && this.root.classList.contains('page-loader--show-text')) {
				const phaseTotal = durationMs + ringDelayMs * maxRing + 80;
				this.textEl.style.transition = `opacity ${phaseTotal}ms ease-in-out`;
				this.textEl.style.opacity = this._expanded ? '0.35' : '0.64';
			}
		} catch (_) {}

		dots.forEach((dot) => {
			const ringIndex = parseInt(dot.dataset.ring || '0', 10) || 0;
			const delay = centerOut ? (ringIndex * ringDelayMs) : ((maxRing - ringIndex) * ringDelayMs);
			const dx = parseFloat(dot.dataset.dx || '0') || 0;
			const dy = parseFloat(dot.dataset.dy || '0') || 0;
			setTimeout(() => {
				dot.style.transition = `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;
				dot.style.transform = `translate(-50%, -50%) translate(${dx * factor}px, ${dy * factor}px) rotate(18deg) scale(1)`;
			}, delay);
		});

		const phaseTotal = durationMs + ringDelayMs * maxRing + 80;
		this._pulseTimer = setTimeout(() => {
			this._expanded = !this._expanded;
			this._startPulse();
		}, phaseTotal);
	}
}


