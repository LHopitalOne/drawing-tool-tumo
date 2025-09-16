import PhyllotaxisField from '../components/PhyllotaxisField.js';

export class MobileComingSoonView {
  constructor(options = {}) {
    const { message = 'Coming soon on mobile' } = options;
    this.message = message;
    this.root = this._build();
    this._onResize = this._handleResize.bind(this);
  }

  _build() {
    const container = document.createElement('div');
    container.className = 'mobile-coming-soon';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');

    // Center content
    const content = document.createElement('div');
    content.className = 'mobile-coming-soon__content';

    // Phyllotaxis field; size is controlled via CSS variables
    this.phyllo = new PhyllotaxisField({ width: 300, height: 300, saturation: 0.8, value: 1, className: 'mobile-coming-soon__phyllo' });

    // Message
    const title = document.createElement('h1');
    title.className = 'mobile-coming-soon__title';
    title.textContent = this.message;
    const subtitle = document.createElement('p');
    subtitle.className = 'mobile-coming-soon__subtitle';
    subtitle.textContent = 'You can reach the developer via:';

    // Contact links
    const links = document.createElement('div');
    links.className = 'mobile-coming-soon__links';
    const aEmail = document.createElement('a');
    aEmail.className = 'mobile-coming-soon__linkitem';
    aEmail.href = 'mailto:alex.aramyan@proton.me';
    aEmail.setAttribute('aria-label', 'Email');
    aEmail.innerHTML = `
      <span class="mobile-coming-soon__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.0.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z"/></svg>
      </span>
    `;
    const aLinkedIn = document.createElement('a');
    aLinkedIn.className = 'mobile-coming-soon__linkitem';
    aLinkedIn.href = 'https://linkedin.com/in/alex-aramyan';
    aLinkedIn.target = '_blank';
    aLinkedIn.rel = 'noopener noreferrer';
    aLinkedIn.setAttribute('aria-label', 'LinkedIn');
    aLinkedIn.innerHTML = `
      <span class="mobile-coming-soon__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.0.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M196.3 512L103.4 512L103.4 212.9L196.3 212.9L196.3 512zM149.8 172.1C120.1 172.1 96 147.5 96 117.8C96 103.5 101.7 89.9 111.8 79.8C121.9 69.7 135.6 64 149.8 64C164 64 177.7 69.7 187.8 79.8C197.9 89.9 203.6 103.6 203.6 117.8C203.6 147.5 179.5 172.1 149.8 172.1zM543.9 512L451.2 512L451.2 366.4C451.2 331.7 450.5 287.2 402.9 287.2C354.6 287.2 347.2 324.9 347.2 363.9L347.2 512L254.4 512L254.4 212.9L343.5 212.9L343.5 253.7L344.8 253.7C357.2 230.2 387.5 205.4 432.7 205.4C526.7 205.4 544 267.3 544 347.7L544 512L543.9 512z"/></svg>
      </span>
    `;
    const aX = document.createElement('a');
    aX.className = 'mobile-coming-soon__linkitem';
    aX.href = 'https://x.com/lhopitalone';
    aX.target = '_blank';
    aX.rel = 'noopener noreferrer';
    aX.setAttribute('aria-label', 'X');
    aX.innerHTML = `
      <span class="mobile-coming-soon__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.0.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M453.2 112L523.8 112L369.6 288.2L551 528L409 528L297.7 382.6L170.5 528L99.8 528L264.7 339.5L90.8 112L236.4 112L336.9 244.9L453.2 112zM428.4 485.8L467.5 485.8L215.1 152L173.1 152L428.4 485.8z"/></svg>
      </span>
    `;
    links.appendChild(aEmail);
    links.appendChild(aLinkedIn);
    links.appendChild(aX);

    // Group subtitle and links together
    const contact = document.createElement('div');
    contact.className = 'mobile-coming-soon__contact';
    contact.appendChild(subtitle);
    contact.appendChild(links);

    content.appendChild(this.phyllo.el());
    content.appendChild(title);
    content.appendChild(contact);
    container.appendChild(content);
    return container;
  }

  mount() {
    document.body.style.background = '#0b0b0b';
    window.resizeTo(window.innerWidth * 1.2, window.innerHeight * 1.2);
    document.body.appendChild(this.root);
    document.body.classList.add('mobile-coming-soon-open');
    // Render after mount so CSS variables are resolved to actual sizes
    requestAnimationFrame(() => { try { this.phyllo.render(); } catch (_) {} });
    window.addEventListener('resize', this._onResize);
  }

  unmount() {
    try { document.body.classList.remove('mobile-coming-soon-open'); } catch (_) {}
    try { this.root.remove(); } catch (_) {}
    try { window.removeEventListener('resize', this._onResize); } catch (_) {}
  }

  _handleResize() {
    try { this.phyllo.render(); } catch (_) {}
  }
}

export default MobileComingSoonView;


