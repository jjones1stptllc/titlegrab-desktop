# TitleGrab Pro Desktop

**Electron-based desktop app for live title search research and report generation.**

Split-screen interface: Embedded browser on left, report builder on right. Capture pages as you research, AI extracts data in real-time, generate WTS reports instantly.

## Features

- 🌐 **Embedded Browser** - Research directly in the app
- 📸 **One-Click Capture** - Screenshot + OCR + AI extraction
- 📁 **Multi-Format Upload** - PDF, PNG, JPG, DOC, DOCX, HTML
- 🧠 **AI Extraction** - Identifies deeds, mortgages, judgments, liens
- 📋 **Live Report Builder** - Watch data populate as you capture
- 📄 **WTS Report Generation** - One-click PDF output
- 🔒 **Code Protection** - Obfuscated & packaged in ASAR

## Quick Start

### 1. Install Dependencies

```bash
# Desktop app
cd titlegrab-desktop
npm install

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env - add your ANTHROPIC_API_KEY
```

### 2. Start Backend

```bash
cd backend
npm start
# Running on http://localhost:3000
```

### 3. Run Desktop App (Development)

```bash
cd titlegrab-desktop
npm run dev
```

## Building for Production

### Mac

```bash
npm run dist:mac
# Output: release/TitleGrab Pro-1.0.0.dmg
```

### Windows

```bash
npm run dist:win
# Output: release/TitleGrab Pro Setup 1.0.0.exe
```

## Code Protection

The build process includes:

1. **Vite Minification** - Code bundled and minified
2. **JavaScript Obfuscation** - Variable renaming, control flow flattening, string encoding
3. **ASAR Packaging** - Source files archived in Electron's ASAR format
4. **Hardened Runtime** (Mac) - Code signing ready

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                │
│  - BrowserView (embedded Chrome)                        │
│  - Screenshot capture                                   │
│  - File system access                                   │
└──────────────────────┬──────────────────────────────────┘
                       │ IPC
┌──────────────────────▼──────────────────────────────────┐
│                    React Renderer                       │
│  - Navigation controls                                  │
│  - Report builder UI                                    │
│  - Extracted data display                               │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│                    Node.js Backend                      │
│  - Tesseract.js OCR                                     │
│  - AI extraction                                        │
│  - PDF report generation                                │
│  - Multi-format file processing                         │
└─────────────────────────────────────────────────────────┘
```

## Supported File Formats

| Format | Extension | Processing |
|--------|-----------|------------|
| PDF | .pdf | Convert pages to images → OCR |
| Images | .png, .jpg, .jpeg, .gif, .webp, .tiff, .bmp | Direct OCR |
| Word | .doc, .docx | Text extraction via mammoth |
| HTML | .html, .htm | Tag stripping → text |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/capture` | POST | Process screenshot from desktop app |
| `/api/process-file` | POST | Process uploaded file (any format) |
| `/api/generate-report` | POST | Generate WTS PDF report |
| `/api/reports/:id/download` | GET | Download generated report |
| `/health` | GET | API health check |

## Environment Variables

### Backend (.env)
```
AI_API_KEY=sk-xxxxx              # Required
PORT=3000                        # Optional
```

## License

Proprietary - 1st PT LLC / Wholesale Title Solutions
