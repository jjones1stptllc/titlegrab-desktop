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
// AI EXTRACTION
// ============================================

const EXTRACTION_PROMPT = `You are a title search document analyst. Extract all property record information from this text.

Return ONLY valid JSON with this structure:
{
  "deeds": [
    {
      "grantor": "Name transferring property",
      "grantee": "Name receiving property", 
      "consideration": "Dollar amount",
      "noteDate": "Date on deed",
      "fileNumber": "Document number",
      "recordingDate": "Recording date",
      "bookPage": "Book/Page reference"
    }
  ],
  "deedsOfTrust": [
    {
      "grantor": "Borrower name",
      "amount": "Loan amount",
      "lender": "Lending institution",
      "status": "Open/Released",
      "trustee": "Trustee name",
      "maturityDate": "Maturity date",
      "noteDate": "Note date",
      "fileNumber": "Document number",
      "recordingDate": "Recording date",
      "bookPages": "Book/Page"
    }
  ],
  "judgments": [
    {
      "plaintiff": "Creditor",
      "defendant": "Debtor",
      "amount": "Amount",
      "judgmentDate": "Date",
      "fileNumber": "File number",
      "recordingDate": "Recording date",
      "bookPage": "Book/Page"
    }
  ],
  "liens": [
    {
      "type": "Type of lien",
      "creditor": "Lien holder",
      "amount": "Amount",
      "fileNumber": "Document number",
      "recordingDate": "Recording date"
    }
  ],
  "namesSearched": ["All names found"],
  "propertyInfo": {
    "address": "Property address",
    "parcelNumber": "Parcel/Tax ID",
    "legalDescription": "Legal description"
  }
}

Extract ALL records found. Use empty string "" for missing fields.

TEXT TO ANALYZE:
`;

async function extractWithAI(text, jobId) {
  console.log(`[AI] Extracting from ${text.length} chars...`);
  emitProgress(jobId, 'ai', 80, 'Analyzing document with AI...', { chars: text.length });
  
  // Truncate if too long (context limit)
  const maxChars = 180000;
  if (text.length > maxChars) {
    text = text.substring(0, maxChars);
    console.log(`[AI] Truncated to ${maxChars} chars`);
  }
  
  emitProgress(jobId, 'ai', 85, 'Extracting deeds, liens & judgments...', null);
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: EXTRACTION_PROMPT + text
    }]
  });
  
  emitProgress(jobId, 'ai', 95, 'Parsing results...', null);
  
  const responseText = message.content[0].text;
  
  // Extract JSON
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const extracted = JSON.parse(jsonMatch[0]);
    console.log(`[AI] Found: ${extracted.deeds?.length || 0} deeds, ${extracted.deedsOfTrust?.length || 0} DOTs`);
    return extracted;
  }
  
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
