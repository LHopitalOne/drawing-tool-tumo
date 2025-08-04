# Quick image drawing and uploading tool

A simple web-based drawing tool that creates 800x800 pixel images with a white brush on a black canvas. Perfect for creating quick sketches that can be easily shared and used in Python programs. You can also upload your own images to the cloud.

Try it yourself: https://lhopitalone.github.io/drawing-tool-tumo
> **Note:** The tool is in Armenian:

## Features

- **600x600 pixel canvas** with black background
- **White brush with soft edges** for smooth drawing
- **Touch support** for mobile devices
- **One-click save** with automatic upload to cloud storage
- **Image upload functionality** for custom images
- **Public link generation** for easy sharing
- **Responsive design** that works on all devices
- **Black and white drawing** (black canvas, white brush)

## Usage

1. **Draw**: Click and drag (or touch and drag on mobile) to draw on the black canvas
2. **Clear**: Click the "Clear Canvas" button to start over
3. **Save**: Click "Save Image" to upload your drawing to cloud storage and get a public link
4. **Upload**: Click "Upload Image" to upload your own images to the cloud

## Local Development

To run the drawing tool locally:

1. Clone this repository:
   ```bash
   git clone https://github.com/LHopitalOne/drawing-tool-tumo.git
   cd drawing-tool-tumo
   ```

2. Open `index.html` in your web browser

## Deployment to GitHub Pages

To deploy this tool to GitHub Pages for public access:

1. **Create a GitHub repository** named `drawing-tool-tumo`

2. **Push your code** to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/LHopitalOne/drawing-tool-tumo.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click "Settings" tab
   - Scroll down to "Pages" section
   - Select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click "Save"

4. **Update the Supabase key** in `script.js`:
   - Open `script.js`
   - Find the Authorization header with `'Bearer YOUR_SUPABASE_KEY_HERE'`
   - Replace with your actual Supabase API key

5. **Commit and push the changes**:
   ```bash
   git add script.js
   git commit -m "Update Supabase key"
   git push
   ```

Your drawing tool will be available at: `https://yourusername.github.io/drawing-tool-tumo/`

## Using with Python

Once deployed, you can use the generated public links in your Python programs:

```python
import requests
from PIL import Image
import io

# Example: Load an image from the public link
image_url = "https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object/public/ai-art-files-bucket/your-uuid-here.jpg"

response = requests.get(image_url)
image = Image.open(io.BytesIO(response.content))

# Display or process the image
image.show()
```

## File Structure

```
QuickImgToLink28x28/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript drawing functionality
├── requirements.txt    # Python dependencies
└── README.md           # This file
```

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Technical Details

- **Canvas Size**: 600x600 pixels (draws at 600x600 on desktop for better UX)
- **Background**: Black (#000000)
- **Brush Color**: White (#FFFFFF)
- **Brush Style**: Soft-edged circular brush
- **Output Format**: JPEG
- **File Naming**: UUID-based naming for cloud storage
- **Cloud Storage**: Supabase storage bucket
- **Drawing Style**: Black and white only (black canvas, white brush)

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE). 
