class DrawingTool {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.brushRadius = 14; // Increased brush size
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        // Set canvas background to black
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Configure drawing settings
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.createSoftBrush();
    }
    
    createSoftBrush() {
        // Create an offscreen canvas for the soft brush
        const r = this.brushRadius;
        this.brushCanvas = document.createElement('canvas');
        this.brushCanvas.width = r * 2;
        this.brushCanvas.height = r * 2;
        const bctx = this.brushCanvas.getContext('2d');
        const gradient = bctx.createRadialGradient(r, r, 0, r, r, r);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        bctx.fillStyle = gradient;
        bctx.fillRect(0, 0, r * 2, r * 2);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        this.canvas.addEventListener('touchstart', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));
        document.getElementById('clearBtn').addEventListener('click', this.clearCanvas.bind(this));
        document.getElementById('saveBtn').addEventListener('click', this.saveImage.bind(this));
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.drawCircle(pos.x, pos.y);
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        e.preventDefault();
        const pos = this.getMousePos(e);
        this.drawInterpolated(this.lastX, this.lastY, pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
    }
    
    drawCircle(x, y) {
        const r = this.brushRadius;
        this.ctx.drawImage(this.brushCanvas, x - r, y - r);
    }
    
    drawInterpolated(x0, y0, x1, y1) {
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const step = this.brushRadius / 2.5; // Overlap for smoothness
        for (let d = 0; d <= dist; d += step) {
            const t = d / dist;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            this.drawCircle(x, y);
        }
    }
    
    handleTouch(e) {
        e.preventDefault();
        const pos = this.getTouchPos(e);
        if (e.type === 'touchstart') {
            this.isDrawing = true;
            this.lastX = pos.x;
            this.lastY = pos.y;
            this.drawCircle(pos.x, pos.y);
        } else if (e.type === 'touchmove' && this.isDrawing) {
            this.drawInterpolated(this.lastX, this.lastY, pos.x, pos.y);
            this.lastX = pos.x;
            this.lastY = pos.y;
        }
    }
    
    stopDrawing() {
        this.isDrawing = false;
    }
    
    clearCanvas() {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    saveImage() {
        this.canvas.toBlob((blob) => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `drawing-${timestamp}.png`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            const publicLink = this.generatePublicLink(filename);
            window.alert(`Image saved as: ${filename}\n\nPublic link (after GitHub Pages deployment):\n${publicLink}\n\nYou can use this link in your Python program to view the image.`);
        }, 'image/png');
    }
    
    generatePublicLink(filename) {
        const repoName = 'QuickImgToLink28x28';
        const username = 'yourusername'; // You'll need to update this
        return `https://${username}.github.io/${repoName}/images/${filename}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DrawingTool();
}); 