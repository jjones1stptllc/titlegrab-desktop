const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const Tesseract = require('tesseract.js');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const sharp = require('sharp');
require('dotenv').config();

// ============================================
// BUNDLED BINARY PATH SETUP
// ============================================

const isDev = process.env.NODE_ENV === 'development';

function setupBundledBinaries() {
  let binPath;
  
  if (isDev) {
    // In development, use system-installed binaries or local bin folder
    binPath = path.join(__dirname, '..', 'bin', process.platform === 'darwin' ? 'mac' : 'win');
  } else {
    // In production (packaged app), binaries are in resources
    // Use RESOURCES_PATH env var passed from main process
    const resourcesPath = process.env.RESOURCES_PATH || __dirname;
    binPath = path.join(resourcesPath, 'bin');
  }
  
  // Check if bundled binaries exist
  const gmPath = path.join(binPath, process.platform === 'win32' ? 'gm.exe' : 'gm');
  const fsSync = require('fs');
  
  if (fsSync.existsSync(gmPath)) {
    // Add bundled bin to PATH
    const libPath = path.join(binPath, 'lib');
    process.env.PATH = `${binPath}:${process.env.PATH}`;
    
    // Set library path for Mac
    if (process.platform === 'darwin') {
      process.env.DYLD_LIBRARY_PATH = `${libPath}:${process.env.DYLD_LIBRARY_PATH || ''}`;
    }
    
    console.log(`[Setup] Using bundled GraphicsMagick from: ${binPath}`);
  } else {
    console.log(`[Setup] Using system GraphicsMagick (bundled not found at ${gmPath})`);
  }
}

setupBundledBinaries();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Storage setup
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Job storage
const jobs = new Map();

// Progress emitter for SSE
const EventEmitter = require('events');
const progressEmitter = new EventEmitter();
progressEmitter.setMaxListeners(100);

function emitProgress(jobId, stage, progress, message, detail = null) {
  progressEmitter.emit(jobId, { stage, progress, message, detail, timestamp: Date.now() });
}

// Ensure directories exist
async function ensureDirectories() {
  const dirs = ['uploads', 'results', 'screenshots', 'ocr-output', 'reports', 'temp'];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// ============================================
// MULTI-FORMAT FILE PROCESSING
// ============================================

async function processFile(filePath, mimeType, jobId) {
  console.log(`[Process] File: ${filePath}, Type: ${mimeType}`);
  
  const ext = path.extname(filePath).toLowerCase();
  let text = '';
  
  try {
    // PDF Processing
    if (ext === '.pdf' || mimeType === 'application/pdf') {
      text = await processPDF(filePath, jobId);
    }
    // Image Processing (PNG, JPG, etc.)
    else if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'].includes(ext) || mimeType?.startsWith('image/')) {
      text = await processImage(filePath);
    }
    // Word Document Processing
    else if (['.doc', '.docx'].includes(ext) || mimeType?.includes('word')) {
      text = await processWord(filePath);
    }
    // HTML Processing
    else if (ext === '.html' || ext === '.htm' || mimeType === 'text/html') {
      text = await processHTML(filePath);
    }
    // Plain text
    else if (ext === '.txt' || mimeType === 'text/plain') {
      text = await fs.readFile(filePath, 'utf-8');
    }
    else {
      throw new Error(`Unsupported file type: ${ext || mimeType}`);
    }
    
    return text;
  } catch (error) {
    console.error(`[Process] Error processing file:`, error);
    throw error;
  }
}

// PDF Processing - handles both text and scanned PDFs
async function processPDF(filePath, jobId) {
  console.log(`[PDF] Processing: ${filePath}`);
  emitProgress(jobId, 'pdf', 20, 'Reading PDF document...', null);
  
  const dataBuffer = await fs.readFile(filePath);
  const pdfData = await pdf(dataBuffer);
  
  // Check if PDF has extractable text
  if (pdfData.text && pdfData.text.trim().length > 100) {
    console.log(`[PDF] Extracted ${pdfData.text.length} chars of text`);
    emitProgress(jobId, 'pdf', 75, 'Text extracted from PDF', { chars: pdfData.text.length, pages: pdfData.numpages });
    return pdfData.text;
  }
  
  // Scanned PDF - need OCR
  console.log(`[PDF] Scanned document detected, running OCR...`);
  emitProgress(jobId, 'ocr', 20, `Scanned PDF detected (${pdfData.numpages} pages) - starting OCR...`, { pages: pdfData.numpages });
  return await ocrPDF(filePath, jobId, pdfData.numpages);
}

// OCR for scanned PDFs
async function ocrPDF(filePath, jobId, pageCount) {
  const { fromPath } = require('pdf2pic');
  const outputDir = path.join('temp', jobId);
  await fs.mkdir(outputDir, { recursive: true });
  
  // Get bundled gm path
  const fsSync = require('fs');
  let gmPath = null;
  const resourcesPath = process.env.RESOURCES_PATH || __dirname;
  const binPath = isDev 
    ? path.join(__dirname, '..', 'bin', process.platform === 'darwin' ? 'mac' : 'win')
    : path.join(resourcesPath, 'bin');
  const gmBinary = path.join(binPath, process.platform === 'win32' ? 'gm.exe' : 'gm');
  
  if (fsSync.existsSync(gmBinary)) {
    gmPath = gmBinary;
    console.log(`[PDF] Using bundled gm: ${gmPath}`);
  }
  
  const options = {
    density: 300,
    saveFilename: 'page',
    savePath: outputDir,
    format: 'png',
    width: 2480,
    height: 3508,
    ...(gmPath && { graphicsMagickPath: gmPath })
  };
  
  const convert = fromPath(filePath, options);
  let fullText = '';
  
  emitProgress(jobId, 'ocr', 15, `Starting OCR on ${pageCount} pages...`, { currentPage: 0, totalPages: pageCount });
  
  for (let i = 1; i <= pageCount; i++) {
    try {
      // Progress: 15% to 75% for OCR phase (60% range)
      const pageProgress = 15 + Math.round((i / pageCount) * 60);
      emitProgress(jobId, 'ocr', pageProgress, `OCR: Page ${i} of ${pageCount}`, { currentPage: i, totalPages: pageCount });
      
      const result = await convert(i);
      console.log(`[PDF] Converted page ${i}/${pageCount}`);
      
      const pageText = await performOCR(result.path, jobId, i, pageCount);
      fullText += `\n--- PAGE ${i} ---\n${pageText}`;
      
      // Cleanup temp image
      await fs.unlink(result.path).catch(() => {});
    } catch (err) {
      console.error(`[PDF] Error on page ${i}:`, err.message);
    }
  }
  
  return fullText;
}


// Image OCR Processing
async function processImage(filePath) {
  console.log(`[Image] Processing: ${filePath}`);
  
  // Optimize image for OCR
  const optimizedPath = filePath + '_optimized.png';
  await sharp(filePath)
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toFile(optimizedPath);
  
  const text = await performOCR(optimizedPath);
  
  // Cleanup
  await fs.unlink(optimizedPath).catch(() => {});
  
  return text;
}

// Word Document Processing
async function processWord(filePath) {
  console.log(`[Word] Processing: ${filePath}`);
  
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// HTML Processing
async function processHTML(filePath) {
  console.log(`[HTML] Processing: ${filePath}`);
  
  const html = await fs.readFile(filePath, 'utf-8');
  
  // Strip HTML tags, keep text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}

// Core OCR function
async function performOCR(imagePath, jobId = null, pageNum = null, totalPages = null) {
  console.log(`[OCR] Processing: ${imagePath}`);
  
  const result = await Tesseract.recognize(imagePath, 'eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\r[OCR] Progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  });
  
  console.log(`\n[OCR] Complete: ${result.data.text.length} chars`);
  return result.data.text;
}

// ============================================
// AI EXTRACTION - OPTIMIZED WITH HAIKU + CACHING
// ============================================

// System prompt (cached for 90% cost savings on subsequent calls)
const EXTRACTION_SYSTEM_PROMPT = `You are an expert title search document analyst. Extract property records with 100% accuracy.

OUTPUT FORMAT: Return ONLY valid JSON. No explanation, no markdown, no code blocks.

SCHEMA:
{
  "confidence": "high|medium|low",
  "deeds": [{"grantor":"","grantee":"","consideration":"","noteDate":"","fileNumber":"","recordingDate":"","bookPage":""}],
  "deedsOfTrust": [{"grantor":"","amount":"","lender":"","status":"Open|Released","trustee":"","maturityDate":"","noteDate":"","fileNumber":"","recordingDate":"","bookPages":""}],
  "judgments": [{"plaintiff":"","defendant":"","amount":"","judgmentDate":"","fileNumber":"","recordingDate":"","bookPage":""}],
  "liens": [{"type":"","creditor":"","amount":"","fileNumber":"","recordingDate":""}],
  "namesSearched": [],
  "propertyInfo": {"address":"","parcelNumber":"","legalDescription":""}
}

RULES:
- Extract EVERY record found, even partial
- Use "" for missing fields, never null or undefined
- confidence: "high" if text is clear, "medium" if some fields unclear, "low" if document is poor quality
- Dates: preserve original format from document
- Amounts: include $ symbol if present
- Status: "Open" unless explicitly released/satisfied

EXAMPLE INPUT:
"Deed Book 123 Page 456 recorded 01/15/2024. John Smith and Mary Smith, husband and wife, grantor, convey to ABC Holdings LLC for $250,000..."

EXAMPLE OUTPUT:
{"confidence":"high","deeds":[{"grantor":"John Smith and Mary Smith","grantee":"ABC Holdings LLC","consideration":"$250,000","noteDate":"","fileNumber":"","recordingDate":"01/15/2024","bookPage":"Book 123 Page 456"}],"deedsOfTrust":[],"judgments":[],"liens":[],"namesSearched":["John Smith","Mary Smith","ABC Holdings LLC"],"propertyInfo":{"address":"","parcelNumber":"","legalDescription":""}}`;

// Models configuration
const AI_MODELS = {
  fast: 'claude-3-5-haiku-20241022',
  accurate: 'claude-sonnet-4-20250514'
};

async function extractWithAI(text, jobId, forceAccurate = false) {
  console.log(`[AI] Extracting from ${text.length} chars...`);
  emitProgress(jobId, 'ai', 80, 'Analyzing document with AI...', { chars: text.length });
  
  // Truncate if too long
  const maxChars = 180000;
  if (text.length > maxChars) {
    text = text.substring(0, maxChars);
    console.log(`[AI] Truncated to ${maxChars} chars`);
  }
  
  // First pass: Use Haiku (fast + cheap)
  const model = forceAccurate ? AI_MODELS.accurate : AI_MODELS.fast;
  console.log(`[AI] Using model: ${model}`);
  emitProgress(jobId, 'ai', 85, `Extracting with ${forceAccurate ? 'high-accuracy' : 'fast'} AI...`, null);
  
  const startTime = Date.now();
  
  const message = await anthropic.messages.create({
    model: model,
    max_tokens: 8000,
    system: [
      {
        type: 'text',
        text: EXTRACTION_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' } // Enable prompt caching
      }
    ],
    messages: [{
      role: 'user',
      content: `Extract all property records from this document:\n\n${text}`
    }]
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[AI] Response received in ${elapsed}s`);
  
  // Track API cost with correct model name
  if (message.usage) {
    const costModel = model.includes('haiku') ? 'anthropic-claude-3-haiku' : 'anthropic-claude-3.5-sonnet';
    trackApiCost(
      costModel,
      'document-extraction',
      message.usage.input_tokens,
      message.usage.output_tokens
    );
    
    // Log cache performance
    if (message.usage.cache_creation_input_tokens) {
      console.log(`[AI] Cache created: ${message.usage.cache_creation_input_tokens} tokens`);
    }
    if (message.usage.cache_read_input_tokens) {
      console.log(`[AI] Cache hit: ${message.usage.cache_read_input_tokens} tokens (90% savings)`);
    }
  }
  
  emitProgress(jobId, 'ai', 92, 'Parsing results...', null);
  
  const responseText = message.content[0].text;
  
  // Extract JSON
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON in AI response');
  }
  
  const extracted = JSON.parse(jsonMatch[0]);
  console.log(`[AI] Found: ${extracted.deeds?.length || 0} deeds, ${extracted.deedsOfTrust?.length || 0} DOTs, confidence: ${extracted.confidence}`);
  
  // Auto-fallback to Sonnet if Haiku reports low confidence
  if (extracted.confidence === 'low' && !forceAccurate) {
    console.log(`[AI] Low confidence detected, retrying with Sonnet for accuracy...`);
    emitProgress(jobId, 'ai', 94, 'Verifying with high-accuracy AI...', null);
    return extractWithAI(text, jobId, true);
  }
  
  return extracted;
  
  throw new Error('No valid JSON in AI response');
}


// ============================================
// PDF REPORT GENERATION
// ============================================

async function generateWTSReport(data, jobId, metadata = {}) {
  console.log(`[PDF] Generating report for job ${jobId}`);
  
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  
  const drawText = (text, x, yPos, options = {}) => {
    const font = options.bold ? helveticaBold : helvetica;
    const size = options.size || 10;
    page.drawText(String(text || ''), { x, y: yPos, size, font, color: rgb(0, 0, 0) });
  };
  
  const drawLine = (yPos) => {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: pageWidth - margin, y: yPos },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5)
    });
  };
  
  const checkSpace = (needed) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };
  
  // Header
  drawText('WHOLESALE TITLE SOLUTIONS', margin, y, { bold: true, size: 14 });
  y -= 20;
  drawText('Current Owner Report', margin, y, { bold: true, size: 12 });
  y -= 30;
  
  // Order Info
  drawLine(y); y -= 15;
  drawText(`Client: ${metadata.client || ''}`, margin, y);
  drawText(`Order Date: ${metadata.orderDate || new Date().toLocaleDateString()}`, 350, y);
  y -= 15;
  drawText(`Order Number: ${metadata.orderNumber || jobId.slice(0, 8)}`, margin, y);
  drawText(`County/City: ${metadata.countyCity || ''}`, 350, y);
  y -= 15;
  drawText(`Borrower: ${metadata.borrower || ''}`, margin, y);
  drawText(`Thru Date: ${metadata.thruDate || new Date().toLocaleDateString()}`, 350, y);
  y -= 25;
  
  // Deeds
  if (data.deeds?.length > 0) {
    checkSpace(100);
    drawText('DEED INFORMATION', margin, y, { bold: true, size: 11 });
    y -= 5; drawLine(y); y -= 15;
    
    for (const deed of data.deeds) {
      checkSpace(70);
      drawText(`Grantor: ${deed.grantor}`, margin, y);
      drawText(`Consideration: ${deed.consideration}`, 350, y); y -= 12;
      drawText(`Grantee: ${deed.grantee}`, margin, y); y -= 12;
      drawText(`Note Date: ${deed.noteDate}`, margin, y);
      drawText(`File Number: ${deed.fileNumber}`, 350, y); y -= 12;
      drawText(`Recording Date: ${deed.recordingDate}`, margin, y);
      drawText(`Book/Page: ${deed.bookPage}`, 350, y); y -= 15;
      drawLine(y); y -= 15;
    }
  }
  
  // Deeds of Trust
  if (data.deedsOfTrust?.length > 0) {
    checkSpace(120); y -= 10;
    drawText('DEED OF TRUST INFORMATION', margin, y, { bold: true, size: 11 });
    y -= 5; drawLine(y); y -= 15;
    
    for (const dot of data.deedsOfTrust) {
      checkSpace(90);
      drawText(`Grantor: ${dot.grantor}`, margin, y);
      drawText(`Amount: ${dot.amount}`, 350, y); y -= 12;
      drawText(`Lender: ${dot.lender}`, margin, y);
      drawText(`Status: ${dot.status}`, 350, y); y -= 12;
      drawText(`Trustee: ${dot.trustee}`, margin, y);
      drawText(`Maturity: ${dot.maturityDate}`, 350, y); y -= 12;
      drawText(`Note Date: ${dot.noteDate}`, margin, y);
      drawText(`File Number: ${dot.fileNumber}`, 350, y); y -= 12;
      drawText(`Recording Date: ${dot.recordingDate}`, margin, y);
      drawText(`Book/Pages: ${dot.bookPages}`, 350, y); y -= 15;
      drawLine(y); y -= 15;
    }
  }
  
  // Judgments
  if (data.judgments?.length > 0) {
    checkSpace(100); y -= 10;
    drawText('JUDGMENT FINDINGS', margin, y, { bold: true, size: 11 });
    y -= 5; drawLine(y); y -= 15;
    
    for (const j of data.judgments) {
      checkSpace(70);
      drawText(`Plaintiff: ${j.plaintiff}`, margin, y);
      drawText(`Amount: ${j.amount}`, 350, y); y -= 12;
      drawText(`Defendant: ${j.defendant}`, margin, y);
      drawText(`Judgment Date: ${j.judgmentDate}`, 350, y); y -= 12;
      drawText(`File Number: ${j.fileNumber}`, margin, y);
      drawText(`Book/Page: ${j.bookPage}`, 350, y); y -= 15;
      drawLine(y); y -= 15;
    }
  }
  
  // Liens
  if (data.liens?.length > 0) {
    checkSpace(80); y -= 10;
    drawText('LIEN FINDINGS', margin, y, { bold: true, size: 11 });
    y -= 5; drawLine(y); y -= 15;
    
    for (const lien of data.liens) {
      checkSpace(60);
      drawText(`Type: ${lien.type}`, margin, y);
      drawText(`Amount: ${lien.amount}`, 350, y); y -= 12;
      drawText(`Creditor: ${lien.creditor}`, margin, y);
      drawText(`File Number: ${lien.fileNumber}`, 350, y); y -= 12;
      drawText(`Recording Date: ${lien.recordingDate}`, margin, y); y -= 15;
      drawLine(y); y -= 15;
    }
  }
  
  // Names Searched
  if (data.namesSearched?.length > 0) {
    checkSpace(50); y -= 10;
    drawText('NAMES SEARCHED', margin, y, { bold: true, size: 11 });
    y -= 5; drawLine(y); y -= 15;
    drawText(data.namesSearched.join(', ').substring(0, 100), margin, y);
  }
  
  // Save
  const pdfBytes = await pdfDoc.save();
  const reportPath = path.join('reports', `${jobId}-report.pdf`);
  await fs.writeFile(reportPath, pdfBytes);
  
  console.log(`[PDF] Saved: ${reportPath}`);
  return reportPath;
}


// ============================================
// API ENDPOINTS
// ============================================

// Capture from desktop app (screenshot)
app.post('/api/capture', upload.single('image'), async (req, res) => {
  const jobId = uuidv4();
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }
    
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    console.log(`[Capture ${jobId}] Processing screenshot from: ${metadata.sourceUrl}`);
    
    // OCR the screenshot
    const text = await processImage(req.file.path);
    
    // AI extraction
    const extractedData = await extractWithAI(text, jobId);
    
    // Cleanup
    await fs.unlink(req.file.path).catch(() => {});
    
    res.json({
      success: true,
      jobId,
      extractedData
    });
    
  } catch (error) {
    console.error(`[Capture ${jobId}] Error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process uploaded file (PDF, DOC, PNG, HTML)
app.post('/api/process-file', upload.single('file'), async (req, res) => {
  // Use client-provided jobId or generate new one
  const jobId = req.body.jobId || uuidv4();
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    console.log(`[Process ${jobId}] File: ${req.file.originalname} (${req.file.mimetype})`);
    
    jobs.set(jobId, {
      id: jobId,
      filename: req.file.originalname,
      status: 'processing',
      createdAt: new Date().toISOString()
    });
    
    emitProgress(jobId, 'upload', 10, 'File received, starting processing...', { filename: req.file.originalname });
    
    // Process file based on type
    emitProgress(jobId, 'processing', 15, 'Analyzing document type...', null);
    const text = await processFile(req.file.path, req.file.mimetype, jobId);
    
    // AI extraction
    const extractedData = await extractWithAI(text, jobId);
    
    // Update job
    jobs.get(jobId).status = 'complete';
    jobs.get(jobId).extractedData = extractedData;
    
    emitProgress(jobId, 'complete', 100, 'Processing complete!', { 
      deeds: extractedData.deeds?.length || 0,
      deedsOfTrust: extractedData.deedsOfTrust?.length || 0,
      judgments: extractedData.judgments?.length || 0,
      liens: extractedData.liens?.length || 0
    });
    
    // Cleanup
    await fs.unlink(req.file.path).catch(() => {});
    
    res.json({
      success: true,
      jobId,
      extractedData
    });
    
  } catch (error) {
    console.error(`[Process ${jobId}] Error:`, error);
    emitProgress(jobId, 'error', 0, `Error: ${error.message}`, null);
    if (jobs.has(jobId)) {
      jobs.get(jobId).status = 'failed';
      jobs.get(jobId).error = error.message;
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// SSE endpoint for progress updates
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  
  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Listen for progress events
  progressEmitter.on(jobId, sendProgress);
  
  // Send initial connection event
  sendProgress({ stage: 'connected', progress: 0, message: 'Connected to progress stream' });
  
  // Cleanup on client disconnect
  req.on('close', () => {
    progressEmitter.removeListener(jobId, sendProgress);
  });
});

// Generate final report
app.post('/api/generate-report', async (req, res) => {
  const jobId = uuidv4();
  
  try {
    const reportData = req.body;
    console.log(`[Report ${jobId}] Generating...`);
    
    const reportPath = await generateWTSReport(reportData, jobId, reportData);
    
    res.json({
      success: true,
      jobId,
      reportUrl: `/api/reports/${jobId}`
    });
    
    // Store for download
    jobs.set(jobId, { reportPath });
    
  } catch (error) {
    console.error(`[Report ${jobId}] Error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download report
app.get('/api/reports/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  
  if (!job?.reportPath) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  res.download(path.resolve(job.reportPath), `WTS-Report-${req.params.jobId.slice(0, 8)}.pdf`);
});

// Get all jobs
app.get('/api/jobs', (req, res) => {
  const jobList = Array.from(jobs.values())
    .filter(j => j.filename)
    .map(j => ({
      id: j.id,
      filename: j.filename,
      status: j.status,
      createdAt: j.createdAt
    }));
  res.json(jobList);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TitleGrab Pro API v2.0',
    features: ['OCR', 'PDF', 'DOC', 'PNG', 'HTML', 'AI Extraction'],
    activeJobs: jobs.size
  });
});


// ============================================
// USER SETTINGS & CUSTOMIZATION
// ============================================

// Storage for user settings (templates, logos, preferences)
const userSettings = new Map();

// API usage tracking
const apiUsageLogs = [];

// Middleware to track API costs
function trackApiCost(service, operation, inputTokens = 0, outputTokens = 0, customCost = null) {
  const costs = {
    'anthropic-claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
    'anthropic-claude-3-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
    'anthropic-claude-3.5-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
    'supabase-auth': { perCall: 0.0 }, // Free tier
    'supabase-storage': { perGB: 0.021 },
    'tesseract-ocr': { perPage: 0.0 }, // Local, free
  };

  let cost = customCost;
  if (!cost && costs[service]) {
    if (costs[service].input) {
      cost = (inputTokens * costs[service].input) + (outputTokens * costs[service].output);
    } else if (costs[service].perCall) {
      cost = costs[service].perCall;
    }
  }

  const entry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    service,
    operation,
    inputTokens,
    outputTokens,
    cost: cost || 0,
    month: new Date().toISOString().slice(0, 7) // YYYY-MM
  };

  apiUsageLogs.push(entry);
  console.log(`[Cost] ${service}/${operation}: $${(cost || 0).toFixed(6)}`);
  return entry;
}

// Ensure directories exist
async function ensureSettingsDirectories() {
  const dirs = ['templates', 'logos'];
  for (const dir of dirs) {
    try {
      await fs.mkdir(path.join(__dirname, dir), { recursive: true });
    } catch (e) {}
  }
}
ensureSettingsDirectories();

// Upload report template (PDF that will be used as base)
app.post('/api/settings/template', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template file provided' });
    }

    const userId = req.body.userId || 'default';
    const templatePath = path.join(__dirname, 'templates', `${userId}-template.pdf`);
    
    // Move uploaded file to templates directory
    await fs.rename(req.file.path, templatePath);
    
    // Update user settings
    const settings = userSettings.get(userId) || {};
    settings.templatePath = templatePath;
    settings.templateName = req.body.templateName || req.file.originalname;
    settings.templateUploadedAt = new Date().toISOString();
    userSettings.set(userId, settings);

    console.log(`[Settings] Template uploaded for user ${userId}`);
    res.json({ 
      success: true, 
      templateName: settings.templateName,
      message: 'Template uploaded successfully'
    });
  } catch (error) {
    console.error('[Settings] Template upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload company logo
app.post('/api/settings/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }

    const userId = req.body.userId || 'default';
    const ext = path.extname(req.file.originalname) || '.png';
    const logoPath = path.join(__dirname, 'logos', `${userId}-logo${ext}`);
    
    // Process and save logo (resize if needed)
    await sharp(req.file.path)
      .resize(300, 100, { fit: 'inside', withoutEnlargement: true })
      .toFile(logoPath);
    
    // Remove temp file
    await fs.unlink(req.file.path).catch(() => {});
    
    // Update user settings
    const settings = userSettings.get(userId) || {};
    settings.logoPath = logoPath;
    settings.logoUploadedAt = new Date().toISOString();
    userSettings.set(userId, settings);

    console.log(`[Settings] Logo uploaded for user ${userId}`);
    res.json({ 
      success: true, 
      message: 'Logo uploaded successfully',
      logoUrl: `http://127.0.0.1:${PORT}/api/settings/${userId}/logo?t=${Date.now()}`
    });
  } catch (error) {
    console.error('[Settings] Logo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user settings
app.get('/api/settings/:userId', async (req, res) => {
  const userId = req.params.userId || 'default';
  const settings = userSettings.get(userId) || {};
  
  // Check if files exist
  if (settings.templatePath) {
    try {
      await fs.access(settings.templatePath);
      settings.hasTemplate = true;
    } catch {
      settings.hasTemplate = false;
    }
  }
  
  if (settings.logoPath) {
    try {
      await fs.access(settings.logoPath);
      settings.hasLogo = true;
      settings.companyLogoUrl = `http://127.0.0.1:${PORT}/api/settings/${userId}/logo?t=${Date.now()}`;
    } catch {
      settings.hasLogo = false;
    }
  }

  // Verify templates array
  if (settings.templates) {
    for (const template of settings.templates) {
      if (template.filePath) {
        try {
          await fs.access(template.filePath);
          template.hasFile = true;
        } catch {
          template.hasFile = false;
        }
      }
      if (template.logoPath) {
        try {
          await fs.access(template.logoPath);
          template.hasLogo = true;
        } catch {
          template.hasLogo = false;
        }
      }
    }
  }
  
  res.json(settings);
});

// Update user settings (preferences)
app.put('/api/settings/:userId', async (req, res) => {
  const userId = req.params.userId || 'default';
  const currentSettings = userSettings.get(userId) || {};
  const newSettings = { ...currentSettings, ...req.body };
  userSettings.set(userId, newSettings);
  
  console.log(`[Settings] Updated for user ${userId}`);
  res.json({ success: true, settings: newSettings });
});

// Save field mappings for template
app.put('/api/settings/:userId/field-mappings', async (req, res) => {
  const userId = req.params.userId || 'default';
  const { fieldMappings } = req.body;
  const currentSettings = userSettings.get(userId) || {};
  currentSettings.fieldMappings = fieldMappings;
  userSettings.set(userId, currentSettings);
  
  console.log(`[Settings] Field mappings saved for user ${userId}:`, fieldMappings?.length || 0, 'fields');
  res.json({ success: true });
});

// Get logo image for embedding
app.get('/api/settings/:userId/logo', async (req, res) => {
  const userId = req.params.userId || 'default';
  const settings = userSettings.get(userId) || {};
  
  if (!settings.logoPath) {
    return res.status(404).json({ error: 'No logo found' });
  }
  
  try {
    await fs.access(settings.logoPath);
    res.sendFile(path.resolve(settings.logoPath));
  } catch {
    res.status(404).json({ error: 'Logo file not found' });
  }
});

// Delete template
app.delete('/api/settings/:userId/template', async (req, res) => {
  const userId = req.params.userId || 'default';
  const settings = userSettings.get(userId) || {};
  
  if (settings.templatePath) {
    try {
      await fs.unlink(settings.templatePath);
    } catch {}
    delete settings.templatePath;
    delete settings.templateName;
    delete settings.templateUploadedAt;
    userSettings.set(userId, settings);
  }
  
  res.json({ success: true });
});

// Delete logo
app.delete('/api/settings/:userId/logo', async (req, res) => {
  const userId = req.params.userId || 'default';
  const settings = userSettings.get(userId) || {};
  
  if (settings.logoPath) {
    try {
      await fs.unlink(settings.logoPath);
    } catch {}
    delete settings.logoPath;
    delete settings.logoUploadedAt;
    userSettings.set(userId, settings);
  }
  
  res.json({ success: true });
});

// ============================================
// MULTI-TEMPLATE SUPPORT
// ============================================

// Create or update a template
app.post('/api/templates', upload.fields([
  { name: 'template', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]), async (req, res) => {
  try {
    const userId = req.body.userId || 'default';
    const templateId = req.body.templateId || `tpl_${Date.now()}`;
    const templateName = req.body.templateName || 'Untitled Template';
    const fieldMappings = req.body.fieldMappings ? JSON.parse(req.body.fieldMappings) : [];

    const settings = userSettings.get(userId) || {};
    if (!settings.templates) settings.templates = [];

    // Find existing template or create new
    let template = settings.templates.find(t => t.id === templateId);
    const isNew = !template;
    
    if (isNew) {
      template = { id: templateId, createdAt: new Date().toISOString() };
      settings.templates.push(template);
    }

    template.name = templateName;
    template.fieldMappings = fieldMappings;
    template.updatedAt = new Date().toISOString();

    // Handle PDF upload
    if (req.files?.template?.[0]) {
      const file = req.files.template[0];
      const templatePath = path.join(__dirname, 'templates', `${templateId}.pdf`);
      await fs.rename(file.path, templatePath);
      template.filePath = templatePath;
      template.fileName = file.originalname;
    }

    // Handle logo upload
    if (req.files?.logo?.[0]) {
      const file = req.files.logo[0];
      const ext = path.extname(file.originalname) || '.png';
      const logoPath = path.join(__dirname, 'logos', `${templateId}${ext}`);
      await fs.rename(file.path, logoPath);
      template.logoPath = logoPath;
      template.hasLogo = true;
    }

    userSettings.set(userId, settings);
    console.log(`[Templates] ${isNew ? 'Created' : 'Updated'} template ${templateId} for user ${userId}`);
    
    res.json({ success: true, template });
  } catch (error) {
    console.error('[Templates] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get template logo
app.get('/api/templates/:templateId/logo', async (req, res) => {
  const templateId = req.params.templateId;
  
  // Find template across all users
  for (const [userId, settings] of userSettings.entries()) {
    const template = settings.templates?.find(t => t.id === templateId);
    if (template?.logoPath) {
      try {
        await fs.access(template.logoPath);
        return res.sendFile(path.resolve(template.logoPath));
      } catch {}
    }
  }
  
  res.status(404).json({ error: 'Logo not found' });
});

// Delete template
app.delete('/api/templates/:templateId', async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.query.userId || 'default';
    
    const settings = userSettings.get(userId) || {};
    const template = settings.templates?.find(t => t.id === templateId);
    
    if (template) {
      // Delete files
      if (template.filePath) {
        try { await fs.unlink(template.filePath); } catch {}
      }
      if (template.logoPath) {
        try { await fs.unlink(template.logoPath); } catch {}
      }
      
      // Remove from array
      settings.templates = settings.templates.filter(t => t.id !== templateId);
      
      // Clear default if it was this template
      if (settings.defaultTemplateId === templateId) {
        delete settings.defaultTemplateId;
      }
      
      userSettings.set(userId, settings);
      console.log(`[Templates] Deleted template ${templateId}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Templates] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REPORT PREVIEW (HTML for editing before PDF)
// ============================================

// Generate HTML preview of report (for editing)
app.post('/api/preview-report', async (req, res) => {
  try {
    const { data, metadata, userId } = req.body;
    const settings = userSettings.get(userId || 'default') || {};
    
    // Get logo as base64 if exists
    let logoBase64 = null;
    if (settings.logoPath) {
      try {
        const logoBuffer = await fs.readFile(settings.logoPath);
        const ext = path.extname(settings.logoPath).slice(1) || 'png';
        logoBase64 = `data:image/${ext};base64,${logoBuffer.toString('base64')}`;
      } catch {}
    }

    const html = generateReportHTML(data, metadata, logoBase64, settings);
    res.json({ success: true, html, settings });
  } catch (error) {
    console.error('[Preview] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate HTML report string
function generateReportHTML(data, metadata, logoBase64, settings) {
  const formatDate = (d) => d || new Date().toLocaleDateString();
  
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; padding: 0.5in; background: white; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .header-left { flex: 1; }
    .header-right { text-align: right; }
    .logo { max-height: 60px; max-width: 200px; }
    .company-name { font-size: 14pt; font-weight: bold; margin-bottom: 5px; }
    .report-title { font-size: 12pt; font-weight: bold; color: #333; }
    .divider { border-top: 1px solid #999; margin: 10px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; margin-bottom: 15px; }
    .info-row { display: flex; }
    .info-label { font-weight: bold; min-width: 100px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11pt; font-weight: bold; background: #f0f0f0; padding: 5px; margin-bottom: 10px; }
    .item { border-bottom: 1px solid #ddd; padding: 8px 0; }
    .item-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 20px; }
    .item-row { display: flex; }
    .item-label { color: #666; min-width: 100px; }
    .editable { border: 1px dashed transparent; padding: 2px; cursor: text; }
    .editable:hover { border-color: #007bff; background: #f8f9fa; }
    .editable:focus { outline: none; border-color: #007bff; background: #fff; }
    @media print { .editable:hover { border-color: transparent; background: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Company Logo">` : ''}
      <div class="company-name editable" contenteditable="true">${settings.companyName || 'WHOLESALE TITLE SOLUTIONS'}</div>
      <div class="report-title">Current Owner Report</div>
    </div>
    <div class="header-right">
      <div><span class="info-label">Order Date:</span> <span class="editable" contenteditable="true">${formatDate(metadata?.orderDate)}</span></div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-grid">
    <div class="info-row"><span class="info-label">Client:</span> <span class="editable" contenteditable="true">${metadata?.client || ''}</span></div>
    <div class="info-row"><span class="info-label">Order Number:</span> <span class="editable" contenteditable="true">${metadata?.orderNumber || ''}</span></div>
    <div class="info-row"><span class="info-label">Borrower:</span> <span class="editable" contenteditable="true">${metadata?.borrower || ''}</span></div>
    <div class="info-row"><span class="info-label">County/City:</span> <span class="editable" contenteditable="true">${metadata?.countyCity || ''}</span></div>
    <div class="info-row"><span class="info-label">Thru Date:</span> <span class="editable" contenteditable="true">${formatDate(metadata?.thruDate)}</span></div>
  </div>

  ${data.deeds?.length > 0 ? `
  <div class="section">
    <div class="section-title">DEED INFORMATION</div>
    ${data.deeds.map(deed => `
    <div class="item">
      <div class="item-grid">
        <div class="item-row"><span class="item-label">Grantor:</span> <span class="editable" contenteditable="true">${deed.grantor || ''}</span></div>
        <div class="item-row"><span class="item-label">Consideration:</span> <span class="editable" contenteditable="true">${deed.consideration || ''}</span></div>
        <div class="item-row"><span class="item-label">Grantee:</span> <span class="editable" contenteditable="true">${deed.grantee || ''}</span></div>
        <div class="item-row"><span class="item-label">Note Date:</span> <span class="editable" contenteditable="true">${deed.noteDate || ''}</span></div>
        <div class="item-row"><span class="item-label">Recording Date:</span> <span class="editable" contenteditable="true">${deed.recordingDate || ''}</span></div>
        <div class="item-row"><span class="item-label">Book/Page:</span> <span class="editable" contenteditable="true">${deed.bookPage || ''}</span></div>
        <div class="item-row"><span class="item-label">File Number:</span> <span class="editable" contenteditable="true">${deed.fileNumber || ''}</span></div>
      </div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${data.deedsOfTrust?.length > 0 ? `
  <div class="section">
    <div class="section-title">DEED OF TRUST INFORMATION</div>
    ${data.deedsOfTrust.map(dot => `
    <div class="item">
      <div class="item-grid">
        <div class="item-row"><span class="item-label">Grantor:</span> <span class="editable" contenteditable="true">${dot.grantor || ''}</span></div>
        <div class="item-row"><span class="item-label">Amount:</span> <span class="editable" contenteditable="true">${dot.amount || ''}</span></div>
        <div class="item-row"><span class="item-label">Lender:</span> <span class="editable" contenteditable="true">${dot.lender || ''}</span></div>
        <div class="item-row"><span class="item-label">Status:</span> <span class="editable" contenteditable="true">${dot.status || ''}</span></div>
        <div class="item-row"><span class="item-label">Trustee:</span> <span class="editable" contenteditable="true">${dot.trustee || ''}</span></div>
        <div class="item-row"><span class="item-label">Maturity:</span> <span class="editable" contenteditable="true">${dot.maturityDate || ''}</span></div>
        <div class="item-row"><span class="item-label">Note Date:</span> <span class="editable" contenteditable="true">${dot.noteDate || ''}</span></div>
        <div class="item-row"><span class="item-label">File Number:</span> <span class="editable" contenteditable="true">${dot.fileNumber || ''}</span></div>
        <div class="item-row"><span class="item-label">Recording Date:</span> <span class="editable" contenteditable="true">${dot.recordingDate || ''}</span></div>
        <div class="item-row"><span class="item-label">Book/Pages:</span> <span class="editable" contenteditable="true">${dot.bookPages || ''}</span></div>
      </div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${data.judgments?.length > 0 ? `
  <div class="section">
    <div class="section-title">JUDGMENT FINDINGS</div>
    ${data.judgments.map(j => `
    <div class="item">
      <div class="item-grid">
        <div class="item-row"><span class="item-label">Plaintiff:</span> <span class="editable" contenteditable="true">${j.plaintiff || ''}</span></div>
        <div class="item-row"><span class="item-label">Amount:</span> <span class="editable" contenteditable="true">${j.amount || ''}</span></div>
        <div class="item-row"><span class="item-label">Defendant:</span> <span class="editable" contenteditable="true">${j.defendant || ''}</span></div>
        <div class="item-row"><span class="item-label">Judgment Date:</span> <span class="editable" contenteditable="true">${j.judgmentDate || ''}</span></div>
        <div class="item-row"><span class="item-label">File Number:</span> <span class="editable" contenteditable="true">${j.fileNumber || ''}</span></div>
        <div class="item-row"><span class="item-label">Book/Page:</span> <span class="editable" contenteditable="true">${j.bookPage || ''}</span></div>
      </div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${data.liens?.length > 0 ? `
  <div class="section">
    <div class="section-title">LIEN FINDINGS</div>
    ${data.liens.map(lien => `
    <div class="item">
      <div class="item-grid">
        <div class="item-row"><span class="item-label">Type:</span> <span class="editable" contenteditable="true">${lien.type || ''}</span></div>
        <div class="item-row"><span class="item-label">Amount:</span> <span class="editable" contenteditable="true">${lien.amount || ''}</span></div>
        <div class="item-row"><span class="item-label">Creditor:</span> <span class="editable" contenteditable="true">${lien.creditor || ''}</span></div>
        <div class="item-row"><span class="item-label">File Number:</span> <span class="editable" contenteditable="true">${lien.fileNumber || ''}</span></div>
        <div class="item-row"><span class="item-label">Recording Date:</span> <span class="editable" contenteditable="true">${lien.recordingDate || ''}</span></div>
      </div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${data.namesSearched?.length > 0 ? `
  <div class="section">
    <div class="section-title">NAMES SEARCHED</div>
    <div class="editable" contenteditable="true">${data.namesSearched.join(', ')}</div>
  </div>
  ` : ''}

</body>
</html>`;
}

// Generate final PDF from edited HTML
app.post('/api/generate-report-from-html', async (req, res) => {
  const jobId = uuidv4();
  
  try {
    const { html, metadata, userId } = req.body;
    const settings = userSettings.get(userId || 'default') || {};
    
    console.log(`[Report ${jobId}] Generating from HTML...`);
    
    // For now, we'll use the existing PDF generation with the data
    // In the future, we could use puppeteer to render HTML to PDF
    const reportData = req.body.data || {};
    const reportPath = await generateWTSReport(reportData, jobId, metadata);
    
    jobs.set(jobId, { reportPath });
    
    res.json({
      success: true,
      jobId,
      reportUrl: `/api/reports/${jobId}`
    });
  } catch (error) {
    console.error(`[Report ${jobId}] Error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN COST TRACKING
// ============================================

// Get cost summary
app.get('/api/admin/costs', async (req, res) => {
  try {
    const { month, startDate, endDate } = req.query;
    
    let filteredLogs = [...apiUsageLogs];
    
    if (month) {
      filteredLogs = filteredLogs.filter(log => log.month === month);
    } else if (startDate && endDate) {
      filteredLogs = filteredLogs.filter(log => 
        log.timestamp >= startDate && log.timestamp <= endDate
      );
    }
    
    // Group by service
    const byService = {};
    filteredLogs.forEach(log => {
      if (!byService[log.service]) {
        byService[log.service] = { calls: 0, cost: 0, inputTokens: 0, outputTokens: 0 };
      }
      byService[log.service].calls++;
      byService[log.service].cost += log.cost;
      byService[log.service].inputTokens += log.inputTokens;
      byService[log.service].outputTokens += log.outputTokens;
    });
    
    // Group by day
    const byDay = {};
    filteredLogs.forEach(log => {
      const day = log.timestamp.slice(0, 10);
      if (!byDay[day]) {
        byDay[day] = { calls: 0, cost: 0 };
      }
      byDay[day].calls++;
      byDay[day].cost += log.cost;
    });
    
    // Calculate totals
    const totalCost = filteredLogs.reduce((sum, log) => sum + log.cost, 0);
    const totalCalls = filteredLogs.length;
    
    // Monthly fixed costs (estimates - you can adjust these)
    const fixedCosts = {
      'supabase-free-tier': 0,
      'github-free-tier': 0,
      'domain-annual': 12 / 12, // $12/year = $1/month
    };
    
    const totalFixed = Object.values(fixedCosts).reduce((a, b) => a + b, 0);
    
    res.json({
      summary: {
        totalCost: totalCost.toFixed(4),
        totalCalls,
        totalFixed: totalFixed.toFixed(2),
        grandTotal: (totalCost + totalFixed).toFixed(2),
        period: month || `${startDate} to ${endDate}` || 'all time'
      },
      byService,
      byDay: Object.entries(byDay).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)),
      fixedCosts,
      recentLogs: filteredLogs.slice(-50).reverse()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available months
app.get('/api/admin/costs/months', (req, res) => {
  const months = [...new Set(apiUsageLogs.map(log => log.month))].sort().reverse();
  res.json(months);
});

// Add manual cost entry (for tracking external costs like domain, etc)
app.post('/api/admin/costs/manual', (req, res) => {
  const { service, description, cost, date } = req.body;
  
  const entry = {
    id: uuidv4(),
    timestamp: date || new Date().toISOString(),
    service: service || 'manual-entry',
    operation: description || 'Manual cost entry',
    inputTokens: 0,
    outputTokens: 0,
    cost: parseFloat(cost) || 0,
    month: (date || new Date().toISOString()).slice(0, 7)
  };
  
  apiUsageLogs.push(entry);
  res.json({ success: true, entry });
});

// Export cost data
app.get('/api/admin/costs/export', (req, res) => {
  const { format } = req.query;
  
  if (format === 'csv') {
    const headers = 'Date,Service,Operation,Input Tokens,Output Tokens,Cost\n';
    const rows = apiUsageLogs.map(log => 
      `${log.timestamp},${log.service},${log.operation},${log.inputTokens},${log.outputTokens},${log.cost.toFixed(6)}`
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=titlegrab-costs.csv');
    res.send(headers + rows);
  } else {
    res.json(apiUsageLogs);
  }
});

// ============================================
// USER AUTHENTICATION (Supabase)
// ============================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://bvgkcaxmewkeuodvjnio.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Middleware to verify auth token
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Create new user (admin only)
app.post('/api/users', async (req, res) => {
  const { email, password, name } = req.body;
  
  try {
    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    
    if (error) throw error;
    
    console.log(`[Auth] Created user: ${email}`);
    res.json({ success: true, user: { id: data.user.id, email: data.user.email } });
    
  } catch (error) {
    console.error('[Auth] Create user error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// List users (admin only)
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) throw error;
    
    const users = data.users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at
    }));
    
    res.json(users);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { error } = await supabase.auth.admin.deleteUser(req.params.userId);
    
    if (error) throw error;
    
    console.log(`[Auth] Deleted user: ${req.params.userId}`);
    res.json({ success: true });
    
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

async function start() {
  await ensureDirectories();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║       TitleGrab Pro API v2.0           ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  Port: ${PORT}                             ║`);
    console.log('║  Formats: PDF, PNG, DOC, DOCX, HTML    ║');
    console.log('║  Features: OCR, AI Extract, PDF Gen    ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log('');
  });
}

start().catch(console.error);
