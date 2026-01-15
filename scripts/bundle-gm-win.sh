#!/bin/bash
# Download GraphicsMagick portable for Windows
# Run this script before packaging for Windows

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BIN_DIR="$PROJECT_DIR/bin/win"

echo "=== Downloading GraphicsMagick for Windows ==="

# Create directory
rm -rf "$BIN_DIR"
mkdir -p "$BIN_DIR"

# GraphicsMagick portable download URL (Q16 version)
GM_VERSION="1.3.45"
GM_URL="https://sourceforge.net/projects/graphicsmagick/files/graphicsmagick-binaries/${GM_VERSION}/GraphicsMagick-${GM_VERSION}-Q16-win64-dll.zip/download"

echo "Downloading GraphicsMagick ${GM_VERSION}..."
cd "$BIN_DIR"

# Download using curl
curl -L -o gm.zip "$GM_URL"

# Extract
echo "Extracting..."
unzip -q gm.zip

# Move files up one level (they're in a subdirectory)
mv GraphicsMagick-*/* . 2>/dev/null || true
rmdir GraphicsMagick-* 2>/dev/null || true
rm gm.zip

echo ""
echo "=== Download complete ==="
ls -la "$BIN_DIR" | head -20
echo ""
echo "gm.exe ready for bundling"
