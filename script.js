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
        // Upload button logic
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
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
        this.canvas.toBlob(async (blob) => {
            try {
                // Generate UUID for filename
                const uuid = this.generateUUID();
                const filename = `${uuid}.jpg`;
                
                // Upload to Supabase storage
                const supabaseUrl = 'https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/ai-art-files-bucket/';
                const uploadUrl = supabaseUrl + filename;
                
                // Create FormData for upload
                const formData = new FormData();
                formData.append('file', blob, filename);
                
                // Upload to Supabase (you'll need to add your bearer token)
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmYWt3bGRxaHJ1bGJzd3lpcW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MDMwNzEsImV4cCI6MjA2Nzk3OTA3MX0.z7SQGca7x0o1pzAaCyZpZDk4IIdhnImUZAdEr-PtGlQ'
                    },
                    body: formData
                });
                
                if (response.ok) {
                    const publicUrl = `https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/public/ai-art-files-bucket/${filename}`;
                    window.alert(`Ապրե´ս, նկարը հաջողությամբ ներմուծվեց!\n\n Կարող ես կոդումդ դնել այս հասցեն նկարն օգտագործելու համար: ${publicUrl}\n\n`);
                } else {
                    throw new Error(`Վայ չստացվեց...: ${response.status} ${response.statusText}`);
                }
                
            } catch (error) {
                console.error('Վայ չստացվեց...:', error);
                window.alert(`Վայ չստացվեց...: ${error.message}\n\n Փոխարենը՝ նկարդ քո համակարգչին ներբեռնեցի`);
                
                // Fallback to local download only
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fallbackFilename = `drawing-${timestamp}.jpg`;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fallbackFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }, 'image/jpeg', 0.95);
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const uuid = this.generateUUID();
            const filename = `${uuid}.jpg`;
            const supabaseUrl = 'https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/ai-art-files-bucket/';
            const uploadUrl = supabaseUrl + filename;
            // Convert to JPEG if not already
            let uploadBlob = file;
            if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
                const img = await this.fileToImage(file);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                uploadBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
            }
            const formData = new FormData();
            formData.append('file', uploadBlob, filename);
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmYWt3bGRxaHJ1bGJzd3lpcW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MDMwNzEsImV4cCI6MjA2Nzk3OTA3MX0.z7SQGca7x0o1pzAaCyZpZDk4IIdhnImUZAdEr-PtGlQ'
                },
                body: formData
            });
            if (response.ok) {
                const publicUrl = this.generatePublicLink(filename);
                window.alert(`Ապրե´ս, նկարը հաջողությամբ ներմուծվեց!\n\n Կարող ես կոդումդ դնել այս հասցեն նկարն օգտագործելու համար: ${publicUrl}\n\n`);
            } else {
                throw new Error(`Վայ չստացվեց...: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Վայ չստացվեց...:', error);
            window.alert(`Վայ չստացվեց...: ${error.message}`);
        } finally {
            e.target.value = '';
        }
    }

    fileToImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (event) {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = event.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    generatePublicLink(filename) {
        return `https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/public/ai-art-files-bucket/${filename}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DrawingTool();
}); 