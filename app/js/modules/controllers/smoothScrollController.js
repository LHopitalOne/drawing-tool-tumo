/**
 * SmoothScrollController
 * Provides smooth scrolling with customizable speed and easing
 */
class SmoothScrollController {
    constructor(speedFactor = 0.5, anchorScrollDuration = 2000) {
        this.speedFactor = speedFactor;
        this.anchorScrollDuration = anchorScrollDuration; // Duration in ms for anchor scrolling
        this.targetScroll = window.scrollY;
        this.currentScroll = window.scrollY;
        this.isScrolling = false;
        
        // For anchor scrolling with easing
        this.isAnchorScrolling = false;
        this.anchorStartScroll = 0;
        this.anchorTargetScroll = 0;
        this.anchorStartTime = 0;
        
        this.handleWheel = this.handleWheel.bind(this);
        this.animate = this.animate.bind(this);
        
        window.addEventListener('wheel', this.handleWheel, { passive: false });
        this.animate();
        
        // Handle anchor link clicks for smooth scrolling
        this.initAnchorLinks();
    }
    
    // Ease in-out cubic function for smooth acceleration and deceleration
    easeInOutCubic(t) {
        return t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        // Cancel any ongoing anchor scroll animation
        this.isAnchorScrolling = false;
        
        this.targetScroll += e.deltaY * this.speedFactor;
        this.targetScroll = Math.max(0, Math.min(this.targetScroll, document.documentElement.scrollHeight - window.innerHeight));
        
        if (!this.isScrolling) {
            this.isScrolling = true;
        }
    }
    
    animate() {
        if (this.isAnchorScrolling) {
            // Handle anchor scrolling with ease-in-out
            const currentTime = performance.now();
            const elapsed = currentTime - this.anchorStartTime;
            const progress = Math.min(elapsed / this.anchorScrollDuration, 1);
            
            const easedProgress = this.easeInOutCubic(progress);
            this.currentScroll = this.anchorStartScroll + (this.anchorTargetScroll - this.anchorStartScroll) * easedProgress;
            
            window.scrollTo(0, this.currentScroll);
            
            if (progress >= 1) {
                this.isAnchorScrolling = false;
                this.targetScroll = this.anchorTargetScroll;
            }
        } else if (Math.abs(this.targetScroll - this.currentScroll) > 0.5) {
            // Regular wheel scrolling with simple easing
            const delta = (this.targetScroll - this.currentScroll) * 0.1;
            this.currentScroll += delta;
            window.scrollTo(0, this.currentScroll);
        } else {
            this.currentScroll = this.targetScroll;
            this.isScrolling = false;
        }
        
        requestAnimationFrame(this.animate);
    }
    
    scrollTo(targetY) {
        const clampedTarget = Math.max(0, Math.min(targetY, document.documentElement.scrollHeight - window.innerHeight));
        
        // Start anchor scrolling animation
        this.isAnchorScrolling = true;
        this.anchorStartScroll = this.currentScroll;
        this.anchorTargetScroll = clampedTarget;
        this.anchorStartTime = performance.now();
    }
    
    initAnchorLinks() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const targetId = anchor.getAttribute('href').substring(1);
                if (targetId) {
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        e.preventDefault();
                        const targetY = targetElement.offsetTop; // Account for fixed nav
                        this.scrollTo(targetY);
                    }
                }
            });
        });
    }
    
    destroy() {
        window.removeEventListener('wheel', this.handleWheel);
    }
}

export default SmoothScrollController;

