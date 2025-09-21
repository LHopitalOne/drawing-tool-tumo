import PhyllotaxisField from '../modules/features/components/PhyllotaxisField.js';

export default class PageLoader {
	constructor() {
		this.root = null;
		this.field = null;
		this._pulseTimer = null;
		this._expanded = true;
	}

	mount() {
		if (this.root) return;
		const root = document.createElement('div');
		root.className = 'page-loader';
		const screenWidth = window.innerWidth || document.documentElement.clientWidth || 500;
		const size = Math.round(screenWidth * 0.15);
		const field = new PhyllotaxisField({ width: size, height: size, className: 'page-loader__phyllo' });
		root.appendChild(field.el());
		document.body.appendChild(root);
		this.root = root;
		this.field = field;
		// Defer render until in DOM so measurements are correct
		requestAnimationFrame(() => {
			field.render();
			setTimeout(() => this._startPulse(), 900);
		});
	}

	unmount() {
		if (!this.root) return;
		if (this._pulseTimer) { try { clearTimeout(this._pulseTimer); } catch (_) {} this._pulseTimer = null; }
		try { this.root.remove(); } catch (_) {}
		this.root = null;
		this.field = null;
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


