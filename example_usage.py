#!/usr/bin/env python3
"""
Example Python script showing how to use images from the QuickImgToLink drawing tool.

This script demonstrates how to:
1. Load an image from a public URL
2. Display the image
3. Process the image (convert to grayscale, resize, etc.)
4. Save the processed image

Requirements:
- requests
- Pillow (PIL)
- matplotlib (for display)
"""

import requests
from PIL import Image
import io
import matplotlib.pyplot as plt
import numpy as np

def load_image_from_url(url):
    """
    Load an image from a public URL.
    
    Args:
        url (str): The public URL of the image
        
    Returns:
        PIL.Image: The loaded image
    """
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes
        image = Image.open(io.BytesIO(response.content))
        return image
    except requests.RequestException as e:
        print(f"Error loading image from URL: {e}")
        return None
    except Exception as e:
        print(f"Error processing image: {e}")
        return None

def display_image(image, title="Image"):
    """
    Display an image using matplotlib.
    
    Args:
        image (PIL.Image): The image to display
        title (str): Title for the plot
    """
    plt.figure(figsize=(8, 8))
    plt.imshow(image, cmap='gray' if image.mode == 'L' else None)
    plt.title(title)
    plt.axis('off')
    plt.show()

def process_image(image):
    """
    Process the image (example: convert to grayscale and resize).
    
    Args:
        image (PIL.Image): The input image
        
    Returns:
        PIL.Image: The processed image
    """
    # Convert to grayscale
    gray_image = image.convert('L')
    
    # Resize to 28x28 (common size for ML models)
    resized_image = gray_image.resize((28, 28), Image.Resampling.LANCZOS)
    
    return resized_image

def main():
    """
    Main function demonstrating the usage.
    """
    print("QuickImgToLink - Python Usage Example")
    print("=" * 40)
    
    # Example URL (replace with your actual image URL)
    # This would be the URL shown in the alert when you save an image
    example_url = "https://yourusername.github.io/QuickImgToLink28x28/images/drawing-2024-01-15T10-30-45-123Z.png"
    
    print(f"Loading image from: {example_url}")
    print("(Replace this URL with the actual URL from your drawing tool)")
    
    # Load the image
    image = load_image_from_url(example_url)
    
    if image is None:
        print("Could not load image. Please check the URL and try again.")
        return
    
    print(f"Image loaded successfully!")
    print(f"Size: {image.size}")
    print(f"Mode: {image.mode}")
    
    # Display original image
    print("\nDisplaying original image...")
    display_image(image, "Original Drawing (200x200)")
    
    # Process the image
    print("\nProcessing image...")
    processed_image = process_image(image)
    
    # Display processed image
    print("Displaying processed image...")
    display_image(processed_image, "Processed Image (28x28 Grayscale)")
    
    # Convert to numpy array for further processing
    image_array = np.array(processed_image)
    print(f"\nImage converted to numpy array:")
    print(f"Shape: {image_array.shape}")
    print(f"Data type: {image_array.dtype}")
    print(f"Value range: {image_array.min()} to {image_array.max()}")
    
    # Example: Save processed image
    output_filename = "processed_drawing.png"
    processed_image.save(output_filename)
    print(f"\nProcessed image saved as: {output_filename}")

if __name__ == "__main__":
    # Check if required packages are available
    try:
        import requests
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError as e:
        print(f"Missing required package: {e}")
        print("Please install required packages:")
        print("pip install requests pillow matplotlib numpy")
        exit(1)
    
    main() 