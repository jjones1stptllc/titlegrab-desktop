const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Registration
  checkRegistration: () => ipcRenderer.invoke('check-registration'),
  submitRegistration: (userData) => ipcRenderer.invoke('submit-registration', userData),

  // Navigation
  navigate: (url) => ipcRenderer.invoke('navigate', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  refresh: () => ipcRenderer.invoke('refresh'),
  getUrl: () => ipcRenderer.invoke('get-url'),

  // Capture & Processing
  capturePage: (metadata) => ipcRenderer.invoke('capture-page', metadata),
  generateReport: (reportData) => ipcRenderer.invoke('generate-report', reportData),

  // Browser visibility
  hideBrowser: () => ipcRenderer.invoke('hide-browser'),
  showBrowser: () => ipcRenderer.invoke('show-browser'),

  // Storage
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // Downloads
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  openDownload: (filePath) => ipcRenderer.invoke('open-download', filePath),
  deleteDownload: (filePath) => ipcRenderer.invoke('delete-download', filePath),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  
  // PDF Processing
  processPdf: (filePath) => ipcRenderer.invoke('process-pdf', filePath),
  selectPdf: () => ipcRenderer.invoke('select-pdf'),

  // File Upload to API server (bypasses browser security)
  uploadFileToServer: (fileData, fileName, metadata) => ipcRenderer.invoke('upload-file-to-server', fileData, fileName, metadata),
  
  // Upload progress listener
  onUploadProgress: (callback) => {
    ipcRenderer.on('upload-progress', (event, data) => callback(data));
  },
  removeUploadProgressListener: () => {
    ipcRenderer.removeAllListeners('upload-progress');
  },

  // Auto-Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Event listeners
  onUrlChanged: (callback) => {
    ipcRenderer.on('url-changed', (event, url) => callback(url));
  },
  onTitleChanged: (callback) => {
    ipcRenderer.on('title-changed', (event, title) => callback(title));
  },
  onLoadingChanged: (callback) => {
    ipcRenderer.on('loading-changed', (event, isLoading) => callback(isLoading));
  },
  onDownloadStarted: (callback) => {
    ipcRenderer.on('download-started', (event, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (event, data) => callback(data));
  },
  onDownloadFailed: (callback) => {
    ipcRenderer.on('download-failed', (event, data) => callback(data));
  },
  onUserStatusChanged: (callback) => {
    ipcRenderer.on('user-status-changed', (event, status) => callback(status));
  },
  onPdfProcessed: (callback) => {
    ipcRenderer.on('pdf-processed', (event, data) => callback(data));
  },
  
  // Update events
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, data) => callback(data));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, data) => callback(data));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('TitleGrab preload script loaded');
