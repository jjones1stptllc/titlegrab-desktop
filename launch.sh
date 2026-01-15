#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Start backend if not running
if ! pgrep -f "titlegrab-pro/backend.*server.js" > /dev/null; then
    cd "/Users/joejones/document scraper/titlegrab-pro/backend"
    nohup node server.js > /tmp/titlegrab-backend.log 2>&1 &
fi

cd "/Users/joejones/document scraper/titlegrab-desktop"

# Start Vite dev server in background if not running
if ! pgrep -f "vite" > /dev/null; then
    nohup npx vite > /tmp/titlegrab-vite.log 2>&1 &
fi

# Wait for Vite to be ready
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Launch Electron (nohup to keep running after script exits)
nohup npx electron . > /tmp/titlegrab-electron.log 2>&1 &

exit 0
