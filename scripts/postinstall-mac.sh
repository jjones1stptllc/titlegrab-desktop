#!/bin/bash
# TitleGrab Pro - Post-install dependency setup for Mac
# This runs after the app is installed

echo "TitleGrab Pro - Setting up dependencies..."

# Check if GraphicsMagick is installed
if ! command -v gm &> /dev/null; then
    echo "Installing GraphicsMagick..."
    
    # Check if Homebrew is installed
    if command -v brew &> /dev/null; then
        brew install graphicsmagick --quiet
        echo "GraphicsMagick installed successfully"
    else
        echo "Note: GraphicsMagick not found. For OCR of scanned PDFs, please install:"
        echo "  brew install graphicsmagick"
        echo "The app will work for text-based PDFs and images without this."
    fi
else
    echo "GraphicsMagick already installed"
fi

echo "Setup complete!"

# Launch the app after installation (as the logged-in user, not root)
LOGGED_IN_USER=$(stat -f "%Su" /dev/console)
if [ -d "/Applications/TitleGrab Pro.app" ]; then
    echo "Launching TitleGrab Pro..."
    sudo -u "$LOGGED_IN_USER" open "/Applications/TitleGrab Pro.app"
fi

exit 0
