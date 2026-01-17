// Time synchronization utility - syncs with NTP via world time API
// All times displayed in EST (America/New_York)

const EST_TIMEZONE = 'America/New_York'
let timeOffset = 0 // Offset between local clock and NTP time in ms
let lastSync = null

// Sync with time server
async function syncWithNTP() {
  try {
    const beforeRequest = Date.now()
    const response = await fetch('https://worldtimeapi.org/api/timezone/America/New_York')
    const afterRequest = Date.now()
    const networkDelay = (afterRequest - beforeRequest) / 2
    
    if (response.ok) {
      const data = await response.json()
      const serverTime = new Date(data.datetime).getTime()
      const localTime = Date.now()
      timeOffset = serverTime - localTime + networkDelay
      lastSync = new Date()
      console.log(`[TimeSync] Synced with NTP. Offset: ${timeOffset}ms`)
      return true
    }
  } catch (error) {
    console.warn('[TimeSync] Failed to sync with primary server, trying backup...')
  }
  
  // Backup: use time.is API
  try {
    const beforeRequest = Date.now()
    const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=America/New_York')
    const afterRequest = Date.now()
    const networkDelay = (afterRequest - beforeRequest) / 2
    
    if (response.ok) {
      const data = await response.json()
      const serverTime = new Date(data.dateTime).getTime()
      const localTime = Date.now()
      timeOffset = serverTime - localTime + networkDelay
      lastSync = new Date()
      console.log(`[TimeSync] Synced with backup NTP. Offset: ${timeOffset}ms`)
      return true
    }
  } catch (error) {
    console.warn('[TimeSync] Backup sync also failed, using local time')
  }
  
  return false
}

// Get current time adjusted for NTP offset
function getNow() {
  return new Date(Date.now() + timeOffset)
}

// Get current date in EST as YYYY-MM-DD
function getTodayEST() {
  const now = getNow()
  return now.toLocaleDateString('en-CA', { timeZone: EST_TIMEZONE }) // en-CA gives YYYY-MM-DD format
}

// Get current date in EST formatted for display
function getDisplayDateEST() {
  const now = getNow()
  return now.toLocaleDateString('en-US', { 
    timeZone: EST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Format a date for display in EST
function formatDateEST(date, options = {}) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    ...options
  })
}

// Format a timestamp for display in EST
function formatTimestampEST(timestamp, options = {}) {
  const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  return d.toLocaleString('en-US', {
    timeZone: EST_TIMEZONE,
    ...options
  })
}

// Get ISO timestamp adjusted for NTP
function getISOTimestamp() {
  return getNow().toISOString()
}

// Get time in EST for display (e.g., "2:30 PM")
function getTimeEST() {
  const now = getNow()
  return now.toLocaleTimeString('en-US', {
    timeZone: EST_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Initialize - sync on startup and every 30 minutes
async function initTimeSync() {
  await syncWithNTP()
  // Re-sync every 30 minutes
  setInterval(syncWithNTP, 30 * 60 * 1000)
}

// Get sync status
function getSyncStatus() {
  return {
    synced: lastSync !== null,
    lastSync: lastSync,
    offset: timeOffset
  }
}

module.exports = {
  initTimeSync,
  syncWithNTP,
  getNow,
  getTodayEST,
  getDisplayDateEST,
  formatDateEST,
  formatTimestampEST,
  getISOTimestamp,
  getTimeEST,
  getSyncStatus,
  EST_TIMEZONE
}
