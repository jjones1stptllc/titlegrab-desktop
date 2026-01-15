const { app, BrowserWindow, BrowserView, ipcMain, dialog, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const Store = require('electron-store');

const store = new Store();
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Handle EPIPE errors (broken pipe when console output stream closes)
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') return; // Ignore broken pipe
});
process.stderr.on('error', (err) => {
  if (err.code === 'EPIPE') return; // Ignore broken pipe
});

let mainWindow;
let browserView;
let heartbeatInterval;
let backendProcess = null;

const BACKEND_PORT = 3000;
const API_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const ADMIN_API_URL = 'https://www.titlegrab.com/admin/api/track';

// ============================================
// BACKEND SERVER MANAGEMENT
// ============================================

function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, 'backend');
  }
  // In production, backend is in resources
  return path.join(process.resourcesPath, 'backend');
}

async function startBackendServer() {
  return new Promise((resolve, reject) => {
    const backendPath = getBackendPath();
    const serverPath = path.join(backendPath, 'server.js');
    
    console.log('[Backend] Starting from:', backendPath);
    
    // Check if server.js exists
    if (!fs.existsSync(serverPath)) {
      console.error('[Backend] server.js not found at:', serverPath);
      reject(new Error('Backend server not found'));
      return;
    }
    
    // Set up environment with expanded PATH for Finder launches
    const extraPaths = [
      '/opt/homebrew/bin',      // Apple Silicon Homebrew
      '/usr/local/bin',         // Intel Homebrew
      '/opt/local/bin',         // MacPorts
      '/usr/bin',
      '/bin'
    ].join(':');
    
    const env = {
      ...process.env,
      PATH: `${extraPaths}:${process.env.PATH || ''}`,
      PORT: BACKEND_PORT.toString(),
      NODE_ENV: isDev ? 'development' : 'production',
      RESOURCES_PATH: app.isPackaged ? process.resourcesPath : __dirname
    };
    
    // Copy .env if it exists
    const envPath = path.join(backendPath, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      });
    }
    
    backendProcess = spawn('node', [serverPath], {
      cwd: backendPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let started = false;
    
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Backend]', output.trim());
      
      // Check for server started message
      if (!started && (output.includes('Port:') || output.includes('listening'))) {
        started = true;
        console.log('[Backend] Server started successfully');
        resolve();
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error('[Backend Error]', data.toString().trim());
    });
    
    backendProcess.on('error', (err) => {
      console.error('[Backend] Failed to start:', err);
      reject(err);
    });
    
    backendProcess.on('exit', (code) => {
      console.log('[Backend] Process exited with code:', code);
      backendProcess = null;
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        console.log('[Backend] Assuming started (timeout)');
        resolve();
      }
    }, 10000);
  });
}

function stopBackendServer() {
  if (backendProcess) {
    console.log('[Backend] Stopping server...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

async function waitForBackend(maxAttempts = 30) {
  const fetch = (await import('node-fetch')).default;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${API_URL}/health`, { timeout: 1000 });
      if (res.ok) {
        console.log('[Backend] Health check passed');
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.error('[Backend] Health check failed after', maxAttempts, 'attempts');
  return false;
}

// ============================================
// DEPENDENCY MANAGEMENT
// ============================================

async function checkGraphicsMagick() {
  // First check for bundled GM
  const bundledGmPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'bin', 'gm')
    : path.join(__dirname, 'bin', process.platform === 'darwin' ? 'mac' : 'win', 'gm');
  
  if (fs.existsSync(bundledGmPath)) {
    console.log('[Dependencies] Found bundled GraphicsMagick at:', bundledGmPath);
    return true;
  }
  
  // Fall back to system GM check
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const proc = spawn(cmd, ['gm'], { shell: true });
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    
    proc.on('error', () => {
      resolve(false);
    });
  });
}

async function installGraphicsMagickMac() {
  console.log('[Dependencies] Installing GraphicsMagick via Homebrew...');
  
  return new Promise((resolve, reject) => {
    // First check if Homebrew is installed
    const brewCheck = spawn('which', ['brew'], { shell: true });
    
    brewCheck.on('close', (code) => {
      if (code !== 0) {
        console.log('[Dependencies] Homebrew not found, showing instructions...');
        dialog.showMessageBox({
          type: 'info',
          title: 'Dependency Required',
          message: 'GraphicsMagick is required for PDF processing.',
          detail: 'Please install Homebrew first, then run:\nbrew install graphicsmagick ghostscript\n\nOr visit: https://brew.sh',
          buttons: ['OK']
        });
        resolve(false);
        return;
      }
      
      // Install GraphicsMagick silently
      const install = spawn('brew', ['install', 'graphicsmagick', 'ghostscript'], {
        shell: true,
        stdio: 'pipe'
      });
      
      install.stdout.on('data', (data) => {
        console.log('[Homebrew]', data.toString().trim());
      });
      
      install.stderr.on('data', (data) => {
        console.log('[Homebrew]', data.toString().trim());
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          console.log('[Dependencies] GraphicsMagick installed successfully');
          resolve(true);
        } else {
          console.error('[Dependencies] Failed to install GraphicsMagick');
          resolve(false);
        }
      });
      
      install.on('error', (err) => {
        console.error('[Dependencies] Install error:', err);
        resolve(false);
      });
    });
  });
}

async function ensureDependencies() {
  const hasGM = await checkGraphicsMagick();
  
  if (hasGM) {
    console.log('[Dependencies] GraphicsMagick found');
    
    // On Mac, also need to check for Ghostscript (required for PDF conversion)
    if (process.platform === 'darwin') {
      // Check common Ghostscript paths (which command doesn't work when launched from Finder)
      const gsPaths = [
        '/opt/homebrew/bin/gs',      // Apple Silicon Homebrew
        '/usr/local/bin/gs',          // Intel Homebrew
        '/usr/bin/gs',                // System
        '/opt/local/bin/gs'           // MacPorts
      ];
      
      const gsPath = gsPaths.find(p => fs.existsSync(p));
      
      if (!gsPath) {
        console.log('[Dependencies] Ghostscript not found, attempting install...');
        
        // Check for Homebrew in common paths
        const brewPaths = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
        const brewPath = brewPaths.find(p => fs.existsSync(p));
        
        if (!brewPath) {
          dialog.showMessageBox({
            type: 'info',
            title: 'Ghostscript Required',
            message: 'Ghostscript is required for PDF processing.',
            detail: 'Please install Homebrew first, then run:\nbrew install ghostscript\n\nOr visit: https://brew.sh',
            buttons: ['OK']
          });
          return false;
        }
        
        // Try to install Ghostscript via Homebrew
        const gsInstalled = await new Promise((resolve) => {
          const install = spawn(brewPath, ['install', 'ghostscript'], { stdio: 'pipe' });
          install.on('close', (installCode) => {
            if (installCode === 0) {
              console.log('[Dependencies] Ghostscript installed successfully');
              resolve(true);
            } else {
              resolve(false);
            }
          });
          install.on('error', () => resolve(false));
        });
        
        if (!gsInstalled) return false;
      } else {
        console.log('[Dependencies] Ghostscript found at:', gsPath);
      }
    }
    
    return true;
  }
  
  console.log('[Dependencies] GraphicsMagick not found');
  
  if (process.platform === 'darwin') {
    // Mac - try to install via Homebrew
    return await installGraphicsMagickMac();
  } else if (process.platform === 'win32') {
    // Windows - try winget first (built into Win10/11)
    console.log('[Dependencies] Attempting to install GraphicsMagick via winget...');
    
    const installed = await new Promise((resolve) => {
      const install = spawn('winget', ['install', '-e', '--id', 'GraphicsMagick.GraphicsMagick', '-h'], {
        shell: true,
        stdio: 'pipe'
      });
      
      install.on('close', (code) => {
        resolve(code === 0);
      });
      
      install.on('error', () => {
        resolve(false);
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        install.kill();
        resolve(false);
      }, 60000);
    });
    
    if (installed) {
      console.log('[Dependencies] GraphicsMagick installed via winget');
      return true;
    }
    
    // Fallback - show manual install dialog
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Dependency Required',
      message: 'GraphicsMagick is required for PDF processing.',
      detail: 'Would you like to open the download page?\n\nAlternatively, you can install via PowerShell:\nwinget install GraphicsMagick.GraphicsMagick',
      buttons: ['Open Download Page', 'Continue Without OCR', 'Cancel'],
      defaultId: 0
    });
    
    if (result.response === 0) {
      require('electron').shell.openExternal('http://www.graphicsmagick.org/download.html');
    }
    
    return result.response === 1; // Continue if user chose to skip
  }
  
  return false;
}

// ============================================
// ADMIN TRACKING FUNCTIONS
// ============================================

async function getMacAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.mac && iface.mac !== '00:00:00:00:00:00' && !iface.internal) {
        return iface.mac;
      }
    }
  }
  return 'unknown';
}

async function trackEvent(action, data = {}) {
  try {
    const fetch = (await import('node-fetch')).default;
    const userId = store.get('userId');
    const installId = store.get('installId');
    
    const payload = {
      action,
      user_id: userId,
      install_id: installId,
      ...data
    };
    
    console.log('[Track] Sending:', action, JSON.stringify(payload));
    
    const response = await fetch(ADMIN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const text = await response.text();
    console.log('[Track] Response status:', response.status, 'body:', text);
    
    if (!text) {
      console.error('[Track] Empty response');
      return null;
    }
    
    const result = JSON.parse(text);
    
    // Check if blocked
    if (result.blocked) {
      console.log('[Track] User is blocked:', result.reason);
      // Show blocked message
      if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Access Denied',
          message: `Your access has been suspended: ${result.reason || 'Contact support'}`,
          buttons: ['OK']
        });
        app.quit();
      }
    }
    
    return result;
  } catch (error) {
    console.error('[Track] Error:', error.message);
    return null;
  }
}

async function registerInstallation() {
  const existingUserId = store.get('userId');
  const existingInstallId = store.get('installId');
  
  // If already registered locally, just send heartbeat
  if (existingUserId && existingInstallId) {
    console.log('[Track] Already registered, sending heartbeat');
    await trackEvent('heartbeat');
    return { registered: true };
  }
  
  // Check if this MAC address is already registered on server
  const mac = await getMacAddress();
  const fetch = (await import('node-fetch')).default;
  
  try {
    const checkResponse = await fetch(ADMIN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'check_mac', 
        mac_address: mac 
      })
    });
    
    const checkResult = await checkResponse.json();
    console.log('[Track] MAC check result:', checkResult);
    
    if (checkResult.found && checkResult.user_id) {
      // Already registered on server - restore locally
      store.set('userId', checkResult.user_id);
      store.set('installId', checkResult.install_id || `reinstall-${Date.now()}`);
      store.set('userName', checkResult.name || '');
      store.set('userOrg', checkResult.organization || '');
      store.set('userEmail', checkResult.email || '');
      console.log('[Track] Restored registration from server:', checkResult.user_id);
      await trackEvent('heartbeat');
      return { registered: true, restored: true };
    }
  } catch (error) {
    console.error('[Track] MAC check error:', error.message);
  }
  
  // Not registered - need to show registration form
  console.log('[Track] Not registered, need user registration');
  return { registered: false, mac_address: mac };
}

// Handle user registration submission
async function submitUserRegistration(userData) {
  const mac = await getMacAddress();
  const result = await trackEvent('register', {
    mac_address: mac,
    name: userData.name,
    organization: userData.organization,
    email: userData.email,
    os: `${os.platform()} ${os.release()}`,
    app_version: app.getVersion() || '1.0.0',
    device_name: os.hostname()
  });
  
  if (result?.user_id && result?.install_id) {
    store.set('userId', result.user_id);
    store.set('installId', result.install_id);
    store.set('userName', userData.name);
    store.set('userOrg', userData.organization);
    store.set('userEmail', userData.email);
    console.log('[Track] Registered new user:', result.user_id);
    return { success: true, user_id: result.user_id };
  }
  
  return { success: false, error: 'Registration failed' };
}

function startHeartbeat() {
  // Send heartbeat every 5 minutes
  heartbeatInterval = setInterval(async () => {
    await trackEvent('heartbeat');
  }, 5 * 60 * 1000);
  
  // Also start status check interval - check every 10 seconds
  setInterval(async () => {
    const userId = store.get('userId');
    if (!userId) {
      mainWindow?.webContents.send('user-status-changed', 'pending');
      return;
    }
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status', user_id: userId })
      });
      const data = await response.json();
      console.log('[Status] Check result:', data);
      if (data.blocked) {
        mainWindow?.webContents.send('user-status-changed', 'blocked');
      } else if (data.status) {
        mainWindow?.webContents.send('user-status-changed', data.status);
      } else {
        mainWindow?.webContents.send('user-status-changed', 'active');
      }
    } catch (error) {
      console.error('[Status] Check failed:', error.message);
      mainWindow?.webContents.send('user-status-changed', 'offline');
    }
  }, 10000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ============================================
// SECURITY & TAMPER DETECTION
// ============================================

const crypto = require('crypto');

// Critical files to monitor for tampering
const CRITICAL_FILES = [
  'main.js',
  'preload.js'
];

let fileHashes = {};

function computeFileHash(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    }
  } catch (e) {
    console.error('[Security] Hash error:', e.message);
  }
  return null;
}

function initializeSecurityHashes() {
  // Only in production - dev files change constantly
  if (isDev) return;
  
  const basePath = app.isPackaged ? process.resourcesPath : __dirname;
  
  CRITICAL_FILES.forEach(file => {
    const filePath = path.join(basePath, file);
    const hash = computeFileHash(filePath);
    if (hash) {
      fileHashes[file] = hash;
      console.log('[Security] Recorded hash for:', file);
    }
  });
}

async function checkIntegrity() {
  // Only in production
  if (isDev) return true;
  
  const basePath = app.isPackaged ? process.resourcesPath : __dirname;
  
  for (const file of CRITICAL_FILES) {
    const filePath = path.join(basePath, file);
    const currentHash = computeFileHash(filePath);
    
    if (fileHashes[file] && currentHash !== fileHashes[file]) {
      console.error('[Security] TAMPERING DETECTED:', file);
      await reportSecurityAlert('tampering', `File modified: ${file}`);
      return false;
    }
  }
  return true;
}

async function reportSecurityAlert(alertType, details) {
  try {
    const fetch = (await import('node-fetch')).default;
    const mac = await getMacAddress();
    
    await fetch(ADMIN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'security_alert',
        user_id: store.get('userId'),
        install_id: store.get('installId'),
        alert_type: alertType,
        details: details,
        mac_address: mac
      })
    });
    
    console.log('[Security] Alert reported:', alertType);
  } catch (e) {
    console.error('[Security] Failed to report alert:', e.message);
  }
}

// Check for debugging/reverse engineering attempts
function detectDebugger() {
  if (isDev) return false;
  
  // Check if dev tools are open unexpectedly
  if (mainWindow?.webContents?.isDevToolsOpened()) {
    reportSecurityAlert('debugging', 'DevTools opened in production');
    return true;
  }
  return false;
}

// Periodic security check
function startSecurityMonitor() {
  if (isDev) return;
  
  // Initial hash capture
  initializeSecurityHashes();
  
  // Check integrity every 30 seconds
  setInterval(async () => {
    const isIntact = await checkIntegrity();
    if (!isIntact) {
      dialog.showErrorBox('Security Error', 'Application integrity compromised. Please reinstall.');
      app.quit();
    }
    
    detectDebugger();
  }, 30000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    show: false, // Don't show until ready
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev // Disable DevTools in production
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  });
  
  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    // On macOS, force the app to become active and frontmost
    if (process.platform === 'darwin') {
      app.dock.show();
      app.focus({ steal: true });
    }
  });
  
  // Block DevTools shortcuts in production
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Block F12, Cmd+Opt+I, Cmd+Shift+I, Ctrl+Shift+I
      if (input.key === 'F12' || 
          (input.meta && input.alt && input.key === 'i') ||
          (input.meta && input.shift && input.key === 'I') ||
          (input.control && input.shift && input.key === 'I')) {
        event.preventDefault();
        reportSecurityAlert('devtools_attempt', `Blocked DevTools shortcut: ${input.key}`);
      }
    });
  }

  // Load React app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools DISABLED - no auto-open
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Create embedded browser view
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:research'
    }
  });

  mainWindow.setBrowserView(browserView);
  
  // Position: below title bar (40px) + toolbar (56px) = 96px from top
  const bounds = mainWindow.getBounds();
  const browserWidth = Math.floor(bounds.width * 0.55);
  browserView.setBounds({ 
    x: 0, 
    y: 96,  // Fixed: accounts for title bar + toolbar
    width: browserWidth, 
    height: bounds.height - 96 
  });
  browserView.setAutoResize({ width: false, height: true });

  // Load default page
  browserView.webContents.loadURL('https://www.google.com');

  // Handle window resize
  mainWindow.on('resize', () => {
    updateBrowserViewBounds();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function updateBrowserViewBounds() {
  if (!mainWindow || !browserView) return;
  const bounds = mainWindow.getBounds();
  const browserWidth = Math.floor(bounds.width * 0.55);
  browserView.setBounds({
    x: 0,
    y: 96,
    width: browserWidth,
    height: bounds.height - 96
  });
}


// ============================================
// IPC HANDLERS
// ============================================

// Registration handlers
ipcMain.handle('check-registration', async () => {
  return await registerInstallation();
});

ipcMain.handle('submit-registration', async (event, userData) => {
  return await submitUserRegistration(userData);
});

ipcMain.handle('navigate', async (event, url) => {
  if (!browserView) return { success: false, error: 'Browser not ready' };
  
  try {
    // Trim whitespace
    url = url.trim();
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it looks like a search query vs URL
      if (!url.includes('.') || url.includes(' ')) {
        // Treat as Google search
        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      } else {
        url = 'https://' + url;
      }
    }
    
    // Track the browse event
    const pageTitle = browserView.webContents.getTitle() || url;
    trackEvent('browse', { url, page_title: pageTitle });
    
    // Use loadURL without await - let it navigate asynchronously
    browserView.webContents.loadURL(url);
    return { success: true, url };
  } catch (error) {
    console.error('[Navigate] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('go-back', async () => {
  if (browserView?.webContents.canGoBack()) {
    browserView.webContents.goBack();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('go-forward', async () => {
  if (browserView?.webContents.canGoForward()) {
    browserView.webContents.goForward();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('refresh', async () => {
  browserView?.webContents.reload();
  return { success: true };
});

ipcMain.handle('hide-browser', async () => {
  if (browserView && mainWindow) {
    mainWindow.removeBrowserView(browserView);
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('show-browser', async () => {
  if (browserView && mainWindow) {
    mainWindow.addBrowserView(browserView);
    updateBrowserViewBounds();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('get-url', async () => {
  return browserView?.webContents.getURL() || '';
});

ipcMain.handle('capture-page', async (event, metadata) => {
  if (!browserView) return { success: false, error: 'Browser not ready' };

  try {
    console.log('[Capture] Starting page capture...');
    
    const image = await browserView.webContents.capturePage();
    const pngBuffer = image.toPNG();
    
    const url = browserView.webContents.getURL();
    const title = browserView.webContents.getTitle();
    
    console.log(`[Capture] Captured: ${title}`);
    
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    
    const formData = new FormData();
    formData.append('image', pngBuffer, {
      filename: 'capture.png',
      contentType: 'image/png'
    });
    formData.append('metadata', JSON.stringify({
      ...metadata,
      sourceUrl: url,
      sourceTitle: title,
      capturedAt: new Date().toISOString()
    }));

    const response = await fetch(`${API_URL}/api/capture`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    console.log('[Capture] Result:', result);
    
    return {
      success: true,
      url,
      title,
      extractedData: result.extractedData,
      jobId: result.jobId
    };
    
  } catch (error) {
    console.error('[Capture] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-report', async (event, reportData) => {
  try {
    const fetch = require('node-fetch');
    
    const response = await fetch(`${API_URL}/api/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });

    const result = await response.json();
    
    if (result.success && result.reportUrl) {
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save WTS Report',
        defaultPath: `WTS-Report-${reportData.orderNumber || Date.now()}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (filePath) {
        const reportResponse = await fetch(`${API_URL}${result.reportUrl}`);
        const buffer = await reportResponse.buffer();
        fs.writeFileSync(filePath, buffer);
        
        // Track report generation with admin panel
        await trackEvent('report', {
          client_name: reportData.client || '',
          order_number: reportData.orderNumber || '',
          county_city: reportData.countyCity || '',
          deeds_count: reportData.deeds?.length || 0,
          dots_count: reportData.deedsOfTrust?.length || 0,
          judgments_count: reportData.judgments?.length || 0,
          liens_count: reportData.liens?.length || 0
        });
        
        return { success: true, filePath };
      }
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('store-get', async (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', async (event, key, value) => {
  store.set(key, value);
  return { success: true };
});

// Get list of downloaded files
ipcMain.handle('get-downloads', async () => {
  const downloadsDir = path.join(app.getPath('userData'), 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(downloadsDir);
  return files.map(file => {
    const filePath = path.join(downloadsDir, file);
    const stats = fs.statSync(filePath);
    return {
      name: file.replace(/^\d+_/, ''), // Remove timestamp prefix
      path: filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      isPdf: file.toLowerCase().endsWith('.pdf')
    };
  }).sort((a, b) => b.createdAt - a.createdAt);
});

// Open downloaded file
ipcMain.handle('open-download', async (event, filePath) => {
  const { shell } = require('electron');
  shell.openPath(filePath);
});

// Delete downloaded file
ipcMain.handle('delete-download', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { success: true };
  }
  return { success: false, error: 'File not found' };
});

// Open downloads folder
ipcMain.handle('open-downloads-folder', async () => {
  const { shell } = require('electron');
  const downloadsDir = path.join(app.getPath('userData'), 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  shell.openPath(downloadsDir);
});

// Process a PDF file and extract text
ipcMain.handle('process-pdf', async (event, filePath) => {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    return {
      success: true,
      text: pdfData.text,
      pages: pdfData.numpages,
      info: pdfData.info
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Select and process a PDF from filesystem
ipcMain.handle('select-pdf', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select PDF Document',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile']
  });
  
  if (result.canceled || !result.filePaths.length) {
    return { success: false, canceled: true };
  }
  
  const filePath = result.filePaths[0];
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      text: pdfData.text,
      pages: pdfData.numpages,
      info: pdfData.info
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


// ============================================
// BROWSER VIEW EVENTS
// ============================================

function setupBrowserViewEvents() {
  if (!browserView) return;

  browserView.webContents.on('did-navigate', (event, url) => {
    // Don't update URL bar for error pages
    if (!url.startsWith('data:')) {
      mainWindow?.webContents.send('url-changed', url);
    }
  });

  browserView.webContents.on('did-navigate-in-page', (event, url) => {
    if (!url.startsWith('data:')) {
      mainWindow?.webContents.send('url-changed', url);
    }
  });

  browserView.webContents.on('page-title-updated', (event, title) => {
    mainWindow?.webContents.send('title-changed', title);
  });

  browserView.webContents.on('did-start-loading', () => {
    mainWindow?.webContents.send('loading-changed', true);
  });

  browserView.webContents.on('did-stop-loading', () => {
    mainWindow?.webContents.send('loading-changed', false);
  });

  // Handle load failures gracefully
  browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[BrowserView] Load failed: ${errorCode} - ${errorDescription} for ${validatedURL}`);
    mainWindow?.webContents.send('loading-changed', false);
    
    // Don't show error for cancelled navigations (user navigated away) or aborted
    if (errorCode === -3 || errorCode === -27) {
      return;
    }
    
    // Show a nice error page in the browser view
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
              background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
              color: #475569;
            }
            .error { 
              text-align: center; 
              padding: 60px;
              background: white;
              border-radius: 16px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              max-width: 500px;
            }
            .icon {
              width: 64px;
              height: 64px;
              margin-bottom: 20px;
              opacity: 0.5;
            }
            h1 { 
              font-size: 22px; 
              margin-bottom: 12px; 
              color: #1e293b;
              font-weight: 600;
            }
            p { 
              font-size: 14px; 
              margin: 8px 0;
              color: #64748b;
            }
            code { 
              background: #f1f5f9; 
              padding: 4px 10px; 
              border-radius: 6px; 
              font-size: 12px;
              color: #334155;
              display: inline-block;
              margin-top: 8px;
            }
            .hint {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <h1>This site can't be reached</h1>
            <p>${errorDescription || 'The connection was refused'}</p>
            <code>${validatedURL}</code>
            <p class="hint">Check the URL and try again, or search for the site.</p>
          </div>
        </body>
      </html>
    `;
    
    browserView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorHtml));
  });

  // Handle PDF and file downloads
  browserView.webContents.session.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const url = item.getURL();
    const mimeType = item.getMimeType();
    
    console.log(`[Download] Starting: ${fileName} (${mimeType}) from ${url}`);
    
    // Create downloads directory in app data
    const downloadsDir = path.join(app.getPath('userData'), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const savePath = path.join(downloadsDir, `${timestamp}_${safeName}`);
    
    item.setSavePath(savePath);
    
    // Notify renderer about download starting
    mainWindow?.webContents.send('download-started', {
      fileName,
      url,
      mimeType,
      savePath
    });
    
    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes();
        const percent = total > 0 ? Math.round((received / total) * 100) : 0;
        mainWindow?.webContents.send('download-progress', { fileName, percent, received, total });
      }
    });
    
    item.once('done', async (event, state) => {
      if (state === 'completed') {
        console.log(`[Download] Completed: ${savePath}`);
        const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
        
        // Auto-process PDFs
        if (isPdf) {
          try {
            console.log(`[PDF] Auto-processing: ${savePath}`);
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(savePath);
            const pdfData = await pdfParse(dataBuffer);
            
            console.log(`[PDF] Extracted ${pdfData.text.length} chars from ${pdfData.numpages} pages`);
            
            // Send to renderer with extracted text
            mainWindow?.webContents.send('download-complete', {
              fileName,
              savePath,
              mimeType,
              isPdf: true,
              autoProcessed: true,
              pdfText: pdfData.text,
              pdfPages: pdfData.numpages,
              pdfInfo: pdfData.info
            });
            
            // Also send a specific event for PDF processing
            mainWindow?.webContents.send('pdf-processed', {
              fileName,
              savePath,
              sourceUrl: url,
              text: pdfData.text,
              pages: pdfData.numpages,
              info: pdfData.info
            });
          } catch (pdfError) {
            console.error(`[PDF] Processing error:`, pdfError.message);
            mainWindow?.webContents.send('download-complete', {
              fileName,
              savePath,
              mimeType,
              isPdf: true,
              autoProcessed: false,
              error: pdfError.message
            });
          }
        } else {
          mainWindow?.webContents.send('download-complete', {
            fileName,
            savePath,
            mimeType,
            isPdf: false
          });
        }
      } else {
        console.log(`[Download] Failed: ${state}`);
        mainWindow?.webContents.send('download-failed', { fileName, error: state });
      }
    });
  });
}

// ============================================
// AUTO-UPDATER
// ============================================

function setupAutoUpdater() {
  if (isDev) {
    console.log('[AutoUpdate] Skipping in development mode');
    return;
  }

  // Configure logging
  autoUpdater.logger = require('electron-log');
  autoUpdater.logger.transports.file.level = 'info';

  // AUTO-DOWNLOAD and AUTO-INSTALL - force updates
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Check for updates silently on startup
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdate] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdate] Update available:', info.version);
    
    // Notify renderer about available update
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    }
    
    // Show notification (auto-downloading in background)
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Downloading update v${info.version}...`,
      detail: 'The update will install automatically when ready.',
      buttons: ['OK'],
      defaultId: 0
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdate] No updates available, current version is latest');
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdate] Error:', err);
    // Don't bother user with update errors unless they initiated a manual check
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s - ` +
      `${Math.round(progressObj.percent)}% (${Math.round(progressObj.transferred / 1024 / 1024)}MB / ${Math.round(progressObj.total / 1024 / 1024)}MB)`;
    console.log('[AutoUpdate]', logMessage);
    
    // Send progress to renderer
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdate] Update downloaded:', info.version);
    
    // Notify renderer
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-downloaded', { version: info.version });
    }
    
    // Auto-restart to install (force update)
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded!',
      detail: 'The application will now restart to install the update.',
      buttons: ['Restart Now'],
      defaultId: 0
    }).then(() => {
      console.log('[AutoUpdate] Restarting to install update...');
      autoUpdater.quitAndInstall(false, true);
    });
  });

  // Check for updates after a short delay (let app fully load first)
  setTimeout(() => {
    console.log('[AutoUpdate] Checking for updates...');
    autoUpdater.checkForUpdates().catch(err => {
      console.log('[AutoUpdate] Check failed (may be offline):', err.message);
    });
  }, 5000);
}

// IPC handler for manual update check
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { success: false, message: 'Updates disabled in development' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(async () => {
  // Allow self-signed certs for government/county sites
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.log('[Cert] Certificate error for:', url, error);
    // Accept all certs for the research browser (county sites often have issues)
    event.preventDefault();
    callback(true);
  });
  
  // Create window FIRST so app appears immediately
  createWindow();
  setupBrowserViewEvents();
  
  // Force app to front on macOS
  if (process.platform === 'darwin') {
    app.focus({ steal: true });
  }
  
  // Now do background initialization (user sees loading in app)
  console.log('[App] Checking dependencies...');
  const depsOk = await ensureDependencies();
  if (!depsOk) {
    console.warn('[App] Some dependencies missing - PDF OCR may not work');
  }
  
  // Start backend server
  console.log('[App] Starting backend server...');
  try {
    await startBackendServer();
    await waitForBackend();
    console.log('[App] Backend ready');
  } catch (err) {
    console.error('[App] Failed to start backend:', err);
    dialog.showErrorBox('Backend Error', 'Failed to start the processing server. Please restart the application.');
  }
  
  // Register with admin panel and start heartbeat
  await registerInstallation();
  startHeartbeat();
  
  // Start security monitoring
  startSecurityMonitor();
  
  // Setup auto-updater
  setupAutoUpdater();
});

app.on('will-quit', () => {
  console.log('[App] Shutting down...');
  stopHeartbeat();
  stopBackendServer();
});

app.on('window-all-closed', () => {
  stopHeartbeat();
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS: Re-create window when dock icon clicked and no windows exist
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    // Show and focus existing window
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
});

console.log('TitleGrab Pro Desktop starting...');
