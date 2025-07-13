# QuickImgToLink - Drawing Tool

A simple web-based drawing tool that creates 200x200 pixel images with a white brush on a black canvas. Perfect for creating quick sketches that can be easily shared and used in Python programs.

## Features

- **200x200 pixel canvas** with black background
- **White brush with soft edges** for smooth drawing
- **Touch support** for mobile devices
- **One-click save** with automatic download
- **Public link generation** for easy sharing
- **Responsive design** that works on all devices

## Usage

1. **Draw**: Click and drag (or touch and drag on mobile) to draw on the black canvas
2. **Clear**: Click the "Clear Canvas" button to start over
3. **Save**: Click "Save Image" to download the drawing and get a public link

## Local Development

To run the drawing tool locally:

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/QuickImgToLink28x28.git
   cd QuickImgToLink28x28
   ```

2. Open `index.html` in your web browser, or serve it using a local server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server
   ```

3. Navigate to `http://localhost:8000` in your browser

## Deployment to GitHub Pages

To deploy this tool to GitHub Pages for public access:

1. **Create a GitHub repository** named `QuickImgToLink28x28`

2. **Push your code** to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/QuickImgToLink28x28.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click "Settings" tab
   - Scroll down to "Pages" section
   - Select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click "Save"

4. **Update the username** in `script.js`:
   - Open `script.js`
   - Find line with `const username = 'yourusername';`
   - Replace `'yourusername'` with your actual GitHub username

5. **Commit and push the changes**:
   ```bash
   git add script.js
   git commit -m "Update username for GitHub Pages"
   git push
   ```

Your drawing tool will be available at: `https://yourusername.github.io/QuickImgToLink28x28/`

## Using with Python

Once deployed, you can use the generated public links in your Python programs:

```python
import requests
from PIL import Image
import io

# Example: Load an image from the public link
image_url = "https://yourusername.github.io/QuickImgToLink28x28/images/drawing-2024-01-15T10-30-45-123Z.jpg"

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
└── README.md           # This file
```

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Technical Details

- **Canvas Size**: 200x200 pixels
- **Background**: Black (#000000)
- **Brush Color**: White (#FFFFFF)
- **Brush Style**: Soft-edged circular brush
- **Output Format**: jpg
- **File Naming**: `drawing-{timestamp}.jpg`

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE). 