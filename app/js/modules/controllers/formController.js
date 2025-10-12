/**
 * FormController
 * Handles contact form submission via Web3Forms
 */
class FormController {
    constructor(formElement, accessKey) {
        this.form = formElement;
        this.accessKey = accessKey;
        this.submitButton = formElement.querySelector('button[type="submit"]');
        this.originalButtonText = this.submitButton ? this.submitButton.textContent : 'Send Message';
        
        this.handleSubmit = this.handleSubmit.bind(this);
        this.init();
    }
    
    init() {
        if (this.form) {
            this.form.addEventListener('submit', this.handleSubmit);
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }
        
        this.setLoadingState(true);
        
        try {
            const formData = new FormData(this.form);
            formData.append('access_key', this.accessKey);
            
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Message sent successfully! We\'ll get back to you soon.');
                this.form.reset();
            } else {
                this.showError('Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            this.showError('An error occurred. Please try again later.');
        } finally {
            this.setLoadingState(false);
        }
    }
    
    validateForm() {
        const inputs = this.form.querySelectorAll('input[required], textarea[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                isValid = false;
                this.showInputError(input);
            } else {
                this.clearInputError(input);
            }
        });
        
        // Validate email format
        const emailInput = this.form.querySelector('input[type="email"]');
        if (emailInput && emailInput.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.value)) {
                isValid = false;
                this.showInputError(emailInput);
            }
        }
        
        return isValid;
    }
    
    showInputError(input) {
        input.style.borderColor = 'rgba(255, 100, 100, 0.5)';
        input.style.background = 'rgba(255, 100, 100, 0.05)';
    }
    
    clearInputError(input) {
        input.style.borderColor = '';
        input.style.background = '';
    }
    
    setLoadingState(isLoading) {
        if (!this.submitButton) return;
        
        if (isLoading) {
            this.submitButton.disabled = true;
            this.submitButton.textContent = 'Sending...';
            this.submitButton.style.opacity = '0.6';
            this.submitButton.style.cursor = 'not-allowed';
        } else {
            this.submitButton.disabled = false;
            this.submitButton.textContent = this.originalButtonText;
            this.submitButton.style.opacity = '';
            this.submitButton.style.cursor = '';
        }
    }
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showMessage(message, type) {
        // Remove any existing message
        const existingMessage = this.form.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `form-message form-message--${type}`;
        messageEl.textContent = message;
        
        // Insert after submit button
        this.submitButton.parentNode.insertBefore(messageEl, this.submitButton.nextSibling);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.opacity = '0';
                setTimeout(() => messageEl.remove(), 300);
            }
        }, 5000);
    }
    
    destroy() {
        if (this.form) {
            this.form.removeEventListener('submit', this.handleSubmit);
        }
    }
}

export default FormController;

