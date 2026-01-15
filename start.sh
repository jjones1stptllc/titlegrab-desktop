#!/bin/bash

# TitleGrab Pro Desktop - Quick Start Script

echo "╔════════════════════════════════════════╗"
echo "║     TitleGrab Pro Desktop Setup        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "✓ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if backend is running
echo ""
echo "🔍 Checking backend connection..."
if curl -s http://154.38.176.77:3000/health > /dev/null; then
    echo "✓ Backend is running"
else
    echo "⚠️  Backend not responding at http://154.38.176.77:3000"
    echo "   Make sure to deploy the backend first"
fi

# Start the app
echo ""
echo "🚀 Starting TitleGrab Pro Desktop..."
echo ""
npm run dev
