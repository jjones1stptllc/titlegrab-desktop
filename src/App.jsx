import { useState, useEffect } from 'react'
import Settings from './Settings'
import AdminPanel from './AdminPanel'
import ReportPreview from './ReportPreview'

const API_URL = 'http://127.0.0.1:3000'

// Professional SVG Icons
const Icons = {
  capture: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  upload: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  document: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  back: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
  forward: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  loading: (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  ),
  deed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  bank: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  gavel: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  link: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  home: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function App() {
  const [url, setUrl] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pageTitle, setPageTitle] = useState('')

  // Registration state
  const [showRegistration, setShowRegistration] = useState(false)
  const [registrationData, setRegistrationData] = useState({ name: '', organization: '', email: '' })
  const [registrationError, setRegistrationError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [checkingRegistration, setCheckingRegistration] = useState(true)

  const [metadata, setMetadata] = useState({
    client: '',
    orderNumber: '',
    countyCity: '',
    borrower: '',
    thruDate: new Date().toLocaleDateString()
  })

  const [captures, setCaptures] = useState([])
  const [extractedData, setExtractedData] = useState({
    deeds: [],
    deedsOfTrust: [],
    judgments: [],
    liens: [],
    namesSearched: [],
    propertyInfo: { address: '', parcelNumber: '', legalDescription: '' }
  })

  const [isCapturing, setIsCapturing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [processingProgress, setProcessingProgress] = useState(0)
  const [activeTab, setActiveTab] = useState('builder') // 'builder', 'recents', 'settings', 'admin'
  const [recentSearches, setRecentSearches] = useState([])
  const [browserHidden, setBrowserHidden] = useState(false)
  const [userStatus, setUserStatus] = useState('connecting') // 'active', 'pending', 'blocked', 'offline', 'connecting'
  const [showPreview, setShowPreview] = useState(false)


  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onUrlChanged((newUrl) => {
        setUrl(newUrl)
        setInputUrl(newUrl)
      })
      window.electronAPI.onTitleChanged((title) => setPageTitle(title))
      window.electronAPI.onLoadingChanged((loading) => setIsLoading(loading))
      loadSession()
      checkRegistration()
    }
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('url-changed')
        window.electronAPI.removeAllListeners('title-changed')
        window.electronAPI.removeAllListeners('loading-changed')
      }
    }
  }, [])

  // Check registration status on startup
  const checkRegistration = async () => {
    if (!window.electronAPI?.checkRegistration) {
      setCheckingRegistration(false)
      return
    }
    
    try {
      const result = await window.electronAPI.checkRegistration()
      console.log('[Registration] Check result:', result)
      
      if (result.registered) {
        setCheckingRegistration(false)
        setShowRegistration(false)
      } else {
        setCheckingRegistration(false)
        setShowRegistration(true)
      }
    } catch (error) {
      console.error('[Registration] Check error:', error)
      setCheckingRegistration(false)
      setShowRegistration(true)
    }
  }

  // Handle registration form submission
  const handleRegistrationSubmit = async (e) => {
    e.preventDefault()
    setRegistrationError('')
    
    if (!registrationData.name.trim() || !registrationData.organization.trim() || !registrationData.email.trim()) {
      setRegistrationError('All fields are required')
      return
    }
    
    if (!registrationData.email.includes('@')) {
      setRegistrationError('Please enter a valid email address')
      return
    }
    
    setIsRegistering(true)
    
    try {
      const result = await window.electronAPI.submitRegistration(registrationData)
      
      if (result.success) {
        setShowRegistration(false)
      } else {
        setRegistrationError(result.error || 'Registration failed. Please try again.')
      }
    } catch (error) {
      setRegistrationError('Registration failed. Please check your connection.')
    } finally {
      setIsRegistering(false)
    }
  }

  const loadSession = async () => {
    if (!window.electronAPI) return
    const savedData = await window.electronAPI.storeGet('currentSession')
    if (savedData) {
      // Only load recents - start with clean Report Builder
      setRecentSearches(savedData.recentSearches || [])
    }
  }

  const saveSession = async () => {
    if (!window.electronAPI) return
    // Only persist recentSearches between app launches
    await window.electronAPI.storeSet('currentSession', { recentSearches })
  }

  useEffect(() => { saveSession() }, [metadata, extractedData, captures, recentSearches])

  // Listen for user status from main process
  useEffect(() => {
    console.log('[App] Setting up status listener')
    if (window.electronAPI?.onUserStatusChanged) {
      window.electronAPI.onUserStatusChanged((status) => {
        console.log('[App] Status received:', status)
        setUserStatus(status)
      })
    }
  }, [])

  const handleNavigate = async (e) => {
    e?.preventDefault()
    if (!inputUrl.trim() || !window.electronAPI) return
    await window.electronAPI.navigate(inputUrl)
  }

  const handleBack = () => window.electronAPI?.goBack()
  const handleForward = () => window.electronAPI?.goForward()
  const handleHome = () => window.electronAPI?.navigate('https://www.google.com')
  const handleRefresh = () => window.electronAPI?.refresh()

  const handleCapture = async () => {
    if (!window.electronAPI) return
    setIsCapturing(true)
    setBrowserHidden(true)
    setProcessingProgress(10)
    window.electronAPI.hideBrowser()
    setProcessingStatus('Capturing page screenshot...')
    try {
      setProcessingProgress(25)
      setProcessingStatus('Running OCR...')
      await new Promise(r => setTimeout(r, 300))
      setProcessingProgress(40)
      setProcessingStatus('Extracting Data...')
      const result = await window.electronAPI.capturePage(metadata)
      setProcessingProgress(85)
      if (result.success && result.extractedData) {
        const data = result.extractedData
        setCaptures(prev => [...prev, {
          id: Date.now(), url: result.url, title: result.title,
          timestamp: new Date().toISOString(), data: data
        }])
        setExtractedData(prev => ({
          deeds: [...prev.deeds, ...(data.deeds || [])],
          deedsOfTrust: [...prev.deedsOfTrust, ...(data.deedsOfTrust || [])],
          judgments: [...prev.judgments, ...(data.judgments || [])],
          liens: [...prev.liens, ...(data.liens || [])],
          namesSearched: [...new Set([...prev.namesSearched, ...(data.namesSearched || [])])],
          propertyInfo: data.propertyInfo || prev.propertyInfo
        }))
        setProcessingProgress(100)
        setProcessingStatus(`✅ Captured: ${data.deeds?.length || 0} deeds, ${data.deedsOfTrust?.length || 0} DOTs`)
        setTimeout(() => { setProcessingStatus(''); setProcessingProgress(0) }, 3000)
      } else {
        setProcessingStatus(`❌ Capture failed: ${result.error || 'No data extracted'}`)
        setTimeout(() => { setProcessingStatus(''); setProcessingProgress(0) }, 5000)
      }
    } catch (error) {
      console.error('Capture failed:', error)
      setProcessingStatus(`❌ Capture error: ${error.message}`)
      setTimeout(() => { setProcessingStatus(''); setProcessingProgress(0) }, 5000)
    } finally {
      setIsCapturing(false)
      setBrowserHidden(false)
      window.electronAPI.showBrowser()
    }
  }

  const handleGenerateReport = async () => {
    if (!window.electronAPI) return
    setIsGenerating(true)
    try {
      const result = await window.electronAPI.generateReport({ ...metadata, ...extractedData })
      if (result.success) {
        // Save to recents
        const recentEntry = {
          id: Date.now(),
          address: extractedData.propertyInfo?.address || metadata.client || 'Unknown Property',
          generatedAt: new Date().toISOString(),
          metadata: { ...metadata },
          extractedData: { ...extractedData },
          captures: [...captures]
        }
        setRecentSearches(prev => [recentEntry, ...prev].slice(0, 50)) // Keep last 50
        
        // Clear current session
        setMetadata({ client: '', orderNumber: '', countyCity: '', borrower: '', thruDate: new Date().toLocaleDateString() })
        setExtractedData({ deeds: [], deedsOfTrust: [], judgments: [], liens: [], namesSearched: [], propertyInfo: { address: '', parcelNumber: '', legalDescription: '' } })
        setCaptures([])
        
        // Switch to recents tab
        setActiveTab('recents')
        
        alert(`Report saved to: ${result.filePath}`)
      } else {
        alert('Failed to generate report: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Generate failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleNewSession = () => {
    if (confirm('Start a new session? This will clear all captured data.')) {
      setMetadata({ client: '', orderNumber: '', countyCity: '', borrower: '', thruDate: new Date().toLocaleDateString() })
      setExtractedData({ deeds: [], deedsOfTrust: [], judgments: [], liens: [], namesSearched: [], propertyInfo: { address: '', parcelNumber: '', legalDescription: '' } })
      setCaptures([])
      setActiveTab('builder')
    }
  }

  const loadRecentSearch = (recent) => {
    setMetadata(recent.metadata)
    setExtractedData(recent.extractedData)
    setCaptures(recent.captures || [])
    setActiveTab('builder')
  }

  const deleteRecentSearch = (id) => {
    setRecentSearches(prev => prev.filter(r => r.id !== id))
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsCapturing(true)
    setBrowserHidden(true)
    setProcessingProgress(5)
    window.electronAPI?.hideBrowser()
    setProcessingStatus(`Uploading ${file.name}...`)
    
    // Generate job ID for progress tracking
    const jobId = crypto.randomUUID()
    let eventSource = null
    
    try {
      // Connect to SSE for progress updates FIRST
      eventSource = new EventSource(`${API_URL}/api/progress/${jobId}`)
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[Progress]', data)
          
          // Update progress bar and status
          if (data.progress !== undefined) {
            setProcessingProgress(data.progress)
          }
          if (data.message) {
            setProcessingStatus(data.message)
          }
          
          // Add page info if available
          if (data.detail?.currentPage && data.detail?.totalPages) {
            setProcessingStatus(`${data.message} (${data.detail.currentPage}/${data.detail.totalPages})`)
          }
        } catch (err) {
          console.error('[Progress] Parse error:', err)
        }
      }
      
      eventSource.onerror = (err) => {
        console.error('[Progress] SSE error:', err)
      }
      
      // Now upload the file with the jobId
      const formData = new FormData()
      formData.append('file', file)
      formData.append('jobId', jobId)
      formData.append('metadata', JSON.stringify(metadata))
      console.log('Uploading file:', file.name, 'jobId:', jobId)
      
      const response = await fetch(`${API_URL}/api/process-file`, { method: 'POST', body: formData })
      const result = await response.json()
      console.log('Upload result:', result)
      
      // Close SSE connection
      eventSource?.close()
      
      if (result.success && result.extractedData) {
        const data = result.extractedData
        setCaptures(prev => [...prev, {
          id: Date.now(), url: `file://${file.name}`, title: file.name,
          timestamp: new Date().toISOString(), data: data
        }])
        setExtractedData(prev => ({
          deeds: [...prev.deeds, ...(data.deeds || [])],
          deedsOfTrust: [...prev.deedsOfTrust, ...(data.deedsOfTrust || [])],
          judgments: [...prev.judgments, ...(data.judgments || [])],
          liens: [...prev.liens, ...(data.liens || [])],
          namesSearched: [...new Set([...prev.namesSearched, ...(data.namesSearched || [])])],
          propertyInfo: data.propertyInfo || prev.propertyInfo
        }))
        setProcessingProgress(100)
        setProcessingStatus(`✅ Extracted: ${data.deeds?.length || 0} deeds, ${data.deedsOfTrust?.length || 0} DOTs, ${data.judgments?.length || 0} judgments`)
        setTimeout(() => { setProcessingStatus(''); setProcessingProgress(0) }, 3000)
      } else {
        setProcessingStatus(`❌ Error: ${result.error || 'Unknown error'}`)
        setTimeout(() => { setProcessingStatus(''); setProcessingProgress(0) }, 5000)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      eventSource?.close()
      setProcessingStatus(`❌ Upload failed: ${error.message}`)
      setTimeout(() => { setProcessingStatus(''); setProcessingProgress(0) }, 5000)
    } finally {
      setIsCapturing(false)
      setBrowserHidden(false)
      window.electronAPI?.showBrowser()
      // Reset file input
      e.target.value = ''
    }
  }


  return (
    <div className="h-screen flex flex-col bg-slate-100 relative">

      {/* Loading state while checking registration */}
      {checkingRegistration && (
        <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading TitleGrab Pro...</p>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {showRegistration && !checkingRegistration && (
        <div className="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-800">Welcome to TitleGrab Pro</h1>
              <p className="text-slate-500 mt-2">Please register to continue</p>
            </div>
            
            <form onSubmit={handleRegistrationSubmit} className="space-y-4">
              {registrationError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {registrationError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={registrationData.name}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isRegistering}
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
                <input
                  type="text"
                  value={registrationData.organization}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, organization: e.target.value }))}
                  placeholder="Acme Title Company"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isRegistering}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={registrationData.email}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@acmetitle.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isRegistering}
                />
              </div>
              
              <button
                type="submit"
                disabled={isRegistering}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isRegistering ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Registering...
                  </>
                ) : (
                  'Get Started'
                )}
              </button>
            </form>
            
            <p className="text-xs text-slate-400 text-center mt-6">
              By registering, you agree to our terms of service. Your information will be used to manage your license.
            </p>
          </div>
        </div>
      )}

      {/* Title Bar */}
      <div className="drag-region h-10 bg-white flex items-center justify-between px-4 border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 pl-16">
          <span className="font-semibold text-slate-800">TitleGrab Pro</span>
        </div>
        <div className="no-drag flex items-center gap-3">
          <StatusBeacon status={userStatus} />
          <button onClick={handleNewSession} className="text-xs text-slate-500 hover:text-slate-700">
            New Session
          </button>
          <span className="text-slate-400 text-xs">{captures.length} captures</span>
        </div>
      </div>

      {/* Browser Toolbar */}
      <div className="h-14 bg-white flex items-center gap-2 px-4 border-b border-slate-200">
        <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700">
          {Icons.back}
        </button>
        <button onClick={handleForward} className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700">
          {Icons.forward}
        </button>
        <button onClick={handleHome} className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700">
          {Icons.home}
        </button>

        <form onSubmit={handleNavigate} className="flex-1 flex gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter URL..."
            className="flex-1 bg-slate-50 border border-slate-300 text-slate-900 px-4 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button type="button" onClick={handleRefresh} className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700">
            {isLoading ? Icons.loading : Icons.refresh}
          </button>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
            Go
          </button>
        </form>

        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
        >
          {isCapturing ? Icons.loading : Icons.capture}
          <span>Capture Page</span>
        </button>

        <label className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer flex items-center gap-2">
          {Icons.upload}
          <span>Upload File</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.html" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Browser placeholder */}
        <div className="w-[55%] bg-slate-200 relative">
          {/* BrowserView renders here via Electron */}
          {/* Processing overlay when browser is hidden */}
          {browserHidden && (
            <div className="absolute inset-0 bg-slate-700 flex flex-col items-center justify-center z-50">
              <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h3 className="text-white text-xl font-semibold mb-2">Processing...</h3>
              <p className="text-slate-300 text-center px-8">{processingStatus || 'Please wait...'}</p>
              <div className="mt-6 w-64 h-3 bg-slate-600 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" style={{width: `${processingProgress}%`}}></div>
              </div>
              <p className="text-slate-400 text-sm mt-2">{processingProgress}%</p>
            </div>
          )}
        </div>

        {/* Right: Report Builder */}
        <div className={`w-[45%] bg-white border-l border-slate-200 flex flex-col min-h-0 transition-all duration-300 ${browserHidden ? 'blur-sm opacity-50 pointer-events-none' : ''}`}>
          {/* Tabs */}
          <div className="flex border-b border-slate-200 flex-shrink-0">
            <button
              onClick={() => setActiveTab('builder')}
              className={`flex-1 px-2 py-3 text-xs font-medium flex items-center justify-center gap-1 ${
                activeTab === 'builder' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {Icons.document}
              Builder
            </button>
            <button
              onClick={() => setActiveTab('recents')}
              className={`flex-1 px-2 py-3 text-xs font-medium flex items-center justify-center gap-1 ${
                activeTab === 'recents' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recents
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-2 py-3 text-xs font-medium flex items-center justify-center gap-1 ${
                activeTab === 'settings' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 px-2 py-3 text-xs font-medium flex items-center justify-center gap-1 ${
                activeTab === 'admin' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Costs
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'settings' ? (
            <Settings userId="default" />
          ) : activeTab === 'admin' ? (
            <AdminPanel />
          ) : activeTab === 'builder' ? (
          <>
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex-shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Client</label>
                <input type="text" value={metadata.client} onChange={(e) => setMetadata({...metadata, client: e.target.value})}
                  className="input mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Order #</label>
                <input type="text" value={metadata.orderNumber} onChange={(e) => setMetadata({...metadata, orderNumber: e.target.value})}
                  className="input mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">County/City</label>
                <input type="text" value={metadata.countyCity} onChange={(e) => setMetadata({...metadata, countyCity: e.target.value})}
                  className="input mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Borrower</label>
                <input type="text" value={metadata.borrower} onChange={(e) => setMetadata({...metadata, borrower: e.target.value})}
                  className="input mt-1" />
              </div>
            </div>
          </div>


          {/* Data Sections - scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <DataSection title="Deeds" icon={Icons.deed} items={extractedData.deeds} color="blue" type="deed" />
            <DataSection title="Deeds of Trust" icon={Icons.bank} items={extractedData.deedsOfTrust} color="emerald" type="dot" />
            <DataSection title="Judgments" icon={Icons.gavel} items={extractedData.judgments} color="amber" type="judgment" />
            <DataSection title="Liens" icon={Icons.link} items={extractedData.liens} color="rose" type="lien" />
            
            {extractedData.namesSearched.length > 0 && (
              <div className="card p-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Names Searched ({extractedData.namesSearched.length})</h3>
                <div className="flex flex-wrap gap-1">
                  {extractedData.namesSearched.map((name, i) => (
                    <span key={i} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generate Buttons */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(true)}
                disabled={extractedData.deeds.length === 0 && extractedData.deedsOfTrust.length === 0}
                className="flex-1 border border-slate-300 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview & Edit
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={isGenerating || (extractedData.deeds.length === 0 && extractedData.deedsOfTrust.length === 0)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white py-2 rounded-md font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {isGenerating ? Icons.loading : Icons.document}
                {isGenerating ? 'Generating...' : 'Generate PDF'}
              </button>
            </div>
          </div>
          </>
          ) : (
          /* Recents Tab */
          <div className="flex-1 overflow-y-auto min-h-0">
            {recentSearches.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">No recent searches</p>
                <p className="text-sm mt-1">Generated reports will appear here</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {recentSearches.map((recent) => (
                  <div key={recent.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-800 truncate">{recent.address}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(recent.generatedAt).toLocaleDateString()} at {new Date(recent.generatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                        <div className="mt-2 space-y-0.5 text-xs">
                          <div className="flex">
                            <span className="text-slate-400 w-20">Client:</span>
                            <span className="text-slate-700 font-medium">{recent.metadata?.client || '—'}</span>
                          </div>
                          <div className="flex">
                            <span className="text-slate-400 w-20">Order #:</span>
                            <span className="text-slate-700 font-medium">{recent.metadata?.orderNumber || '—'}</span>
                          </div>
                          <div className="flex">
                            <span className="text-slate-400 w-20">County/City:</span>
                            <span className="text-slate-700 font-medium">{recent.metadata?.countyCity || '—'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2 text-xs text-slate-500">
                          <span>{recent.extractedData?.deeds?.length || 0} deeds</span>
                          <span>•</span>
                          <span>{recent.extractedData?.deedsOfTrust?.length || 0} DOTs</span>
                          <span>•</span>
                          <span>{recent.extractedData?.judgments?.length || 0} judgments</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3">
                        <button
                          onClick={() => loadRecentSearch(recent)}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium px-2 py-1 hover:bg-blue-50 rounded"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteRecentSearch(recent.id)}
                          className="text-slate-400 hover:text-red-500 text-xs px-2 py-1 hover:bg-red-50 rounded"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Report Preview Modal */}
      {showPreview && (
        <ReportPreview
          data={extractedData}
          metadata={metadata}
          userId="default"
          onClose={() => setShowPreview(false)}
          onGenerate={(result) => {
            setShowPreview(false)
            if (result.success && window.electronAPI) {
              window.electronAPI.downloadReport(result.reportUrl)
            }
          }}
        />
      )}
    </div>
  )
}

function StatusBeacon({ status }) {
  const statusConfig = {
    active: { color: 'bg-emerald-500', pulse: true, label: 'Online' },
    pending: { color: 'bg-amber-500', pulse: true, label: 'Pending' },
    blocked: { color: 'bg-red-500', pulse: false, label: 'Blocked' },
    offline: { color: 'bg-slate-400', pulse: false, label: 'Offline' },
    connecting: { color: 'bg-blue-500', pulse: true, label: 'Connecting' },
    inactive: { color: 'bg-slate-400', pulse: false, label: 'Inactive' },
  }
  
  const config = statusConfig[status] || statusConfig.offline
  
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100" title={`Status: ${config.label}`}>
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`}></div>
        {config.pulse && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${config.color} animate-ping opacity-75`}></div>
        )}
      </div>
      <span className="text-xs text-slate-600 font-medium">{config.label}</span>
    </div>
  )
}

function DataSection({ title, icon, items, color, type }) {
  const [isOpen, setIsOpen] = useState(true)
  
  const colorMap = {
    blue: 'border-blue-200 bg-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    rose: 'border-rose-200 bg-rose-50'
  }

  return (
    <div className={`card border ${items.length > 0 ? colorMap[color] : 'border-slate-200'}`}>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full p-3 flex items-center justify-between text-left">
        <span className="font-medium text-slate-800 flex items-center gap-2">
          {icon} {title}
          <span className="text-slate-400 font-normal">({items.length})</span>
        </span>
        {isOpen ? Icons.chevronDown : Icons.chevronRight}
      </button>
      
      {isOpen && items.length > 0 && (
        <div className="px-3 pb-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded p-2 text-sm border border-slate-100">
              {type === 'deed' && (
                <>
                  <div className="font-medium text-slate-800">{item.grantor} → {item.grantee}</div>
                  <div className="text-slate-500 text-xs">{item.consideration} | {item.recordingDate} | {item.bookPage}</div>
                </>
              )}
              {type === 'dot' && (
                <>
                  <div className="font-medium text-slate-800">{item.amount} - {item.lender}</div>
                  <div className="text-slate-500 text-xs">{item.grantor} | {item.status} | {item.recordingDate}</div>
                </>
              )}
              {type === 'judgment' && (
                <>
                  <div className="font-medium text-slate-800">{item.plaintiff} vs {item.defendant}</div>
                  <div className="text-slate-500 text-xs">{item.amount} | {item.judgmentDate} | {item.fileNumber}</div>
                </>
              )}
              {type === 'lien' && (
                <>
                  <div className="font-medium text-slate-800">{item.type} - {item.creditor}</div>
                  <div className="text-slate-500 text-xs">{item.amount} | {item.recordingDate}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      
      {isOpen && items.length === 0 && (
        <div className="px-3 pb-3 text-slate-400 text-sm">No {title.toLowerCase()} found yet</div>
      )}
    </div>
  )
}

export default App
