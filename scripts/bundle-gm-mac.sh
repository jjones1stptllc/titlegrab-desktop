#!/bin/bash
# Bundle GraphicsMagick and dependencies for TitleGrab Pro Mac distribution
# Run this from the titlegrab-desktop directory

set -e

BIN_DIR="bin/mac"
LIB_DIR="bin/mac/lib"

echo "=== Bundling GraphicsMagick for Mac ==="

# Create directories
mkdir -p "$BIN_DIR"
mkdir -p "$LIB_DIR"

# Copy gm binary
echo "Copying gm binary..."
cp /opt/homebrew/bin/gm "$BIN_DIR/"

# Function to copy library and its dependencies
copy_lib() {
    local lib_path="$1"
    local lib_name=$(basename "$lib_path")
    
    # Skip system libraries
    if [[ "$lib_path" == /usr/lib/* ]] || [[ "$lib_path" == /System/* ]]; then
        return
    fi
    
    # Skip if already copied
    if [[ -f "$LIB_DIR/$lib_name" ]]; then
        return
    fi
    
    echo "  Copying: $lib_name"
    cp "$lib_path" "$LIB_DIR/"
    chmod 755 "$LIB_DIR/$lib_name"
    
    # Recursively copy dependencies
    for dep in $(otool -L "$lib_path" 2>/dev/null | grep -v ":" | awk '{print $1}'); do
        if [[ "$dep" != /usr/lib/* ]] && [[ "$dep" != /System/* ]] && [[ -f "$dep" ]]; then
            copy_lib "$dep"
        fi
    done
}

# Copy all dependencies
echo "Copying dependencies..."
for dep in $(otool -L /opt/homebrew/bin/gm | grep -v ":" | awk '{print $1}'); do
    copy_lib "$dep"
done

# Also get libGraphicsMagick dependencies
echo "Copying libGraphicsMagick dependencies..."
GM_LIB=$(otool -L /opt/homebrew/bin/gm | grep GraphicsMagick | awk '{print $1}')
for dep in $(otool -L "$GM_LIB" 2>/dev/null | grep -v ":" | awk '{print $1}'); do
    copy_lib "$dep"
done

# Fix library paths in gm binary
echo "Fixing library paths in gm..."
for lib in "$LIB_DIR"/*.dylib; do
    lib_name=$(basename "$lib")
    # Get the original path from gm
    original_path=$(otool -L "$BIN_DIR/gm" | grep "$lib_name" | awk '{print $1}' | head -1)
    if [[ -n "$original_path" ]]; then
        install_name_tool -change "$original_path" "@executable_path/lib/$lib_name" "$BIN_DIR/gm" 2>/dev/null || true
    fi
done

# Fix library paths within each dylib
echo "Fixing library paths in dylibs..."
for lib in "$LIB_DIR"/*.dylib; do
    lib_name=$(basename "$lib")
    
    # Fix the library's own ID
    install_name_tool -id "@executable_path/lib/$lib_name" "$lib" 2>/dev/null || true
    
    # Fix references to other libs
    for other_lib in "$LIB_DIR"/*.dylib; do
        other_name=$(basename "$other_lib")
        original_path=$(otool -L "$lib" | grep "$other_name" | awk '{print $1}' | head -1)
        if [[ -n "$original_path" ]] && [[ "$original_path" != @* ]]; then
            install_name_tool -change "$original_path" "@executable_path/lib/$other_name" "$lib" 2>/dev/null || true
        fi
    done
done

# Verify
echo ""
echo "=== Verification ==="
echo "Files created:"
ls -la "$BIN_DIR/"
ls -la "$LIB_DIR/"

echo ""
echo "gm dependencies (should all be @executable_path or /usr/lib):"
otool -L "$BIN_DIR/gm"

echo ""
echo "=== Done! ==="
