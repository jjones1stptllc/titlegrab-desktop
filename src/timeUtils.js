// Time utilities for React renderer process
// Uses IPC to get NTP-synced time from main process, with fallback to local time

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const EST_TIMEZONE = 'America/New_York';

// Get NTP-synced timestamp from main process
export async function getNTPTime() {
  if (ipcRenderer) {
    try {
      const result = await ipcRenderer.invoke('get-ntp-time');
      return new Date(result.timestamp);
    } catch (e) {
      console.warn('[TimeSync] IPC failed, using local time');
    }
  }
  return new Date();
}

// Get today's date in EST (YYYY-MM-DD format)
export async function getTodayEST() {
  if (ipcRenderer) {
    try {
      return await ipcRenderer.invoke('get-est-date');
    } catch (e) {
      console.warn('[TimeSync] IPC failed, using local time');
    }
  }
  return new Date().toLocaleDateString('en-CA', { timeZone: EST_TIMEZONE });
}

// Get today's date formatted for display
export async function getDisplayDateEST() {
  if (ipcRenderer) {
    try {
      return await ipcRenderer.invoke('get-est-display-date');
    } catch (e) {
      console.warn('[TimeSync] IPC failed, using local time');
    }
  }
  return new Date().toLocaleDateString('en-US', { 
    timeZone: EST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Synchronous versions (use cached offset or local time)
// These don't require await and work for immediate rendering

export function formatDateEST(date, options = {}) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    ...options
  });
}

export function formatTimestampEST(timestamp, options = {}) {
  const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return d.toLocaleString('en-US', {
    timeZone: EST_TIMEZONE,
    ...options
  });
}

export function formatTimeEST(timestamp) {
  const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return d.toLocaleTimeString('en-US', {
    timeZone: EST_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Get current date for thruDate field (synchronous, uses local time adjusted for EST)
export function getCurrentDateEST() {
  return new Date().toLocaleDateString('en-US', { timeZone: EST_TIMEZONE });
}

// Get ISO timestamp (for API calls)
export function getISOTimestamp() {
  return new Date().toISOString();
}

export { EST_TIMEZONE };
