import { useState, useEffect, useRef } from 'react'

const API_URL = 'http://147.93.185.218'

export default function ReportPreview({ data, metadata, userId = 'default', onClose, onGenerate }) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [adjustments, setAdjustments] = useState({
    headerSpacing: 0,
    sectionSpacing: 0,
    itemSpacing: 0,
    fontSize: 10,
    margins: 0.5
  })
  const [editHistory, setEditHistory] = useState([])
  const iframeRef = useRef(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    if (selectedTemplateId !== null) {
      loadPreview()
    }
  }, [data, metadata, selectedTemplateId])

  useEffect(() => {
    if (iframeRef.current?.contentDocument) {
      applyAdjustments()
    }
  }, [adjustments])

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/${userId}`)
      const settings = await res.json()
      setTemplates(settings.templates || [])
      // Auto-select default template or first one
      if (settings.defaultTemplateId) {
        setSelectedTemplateId(settings.defaultTemplateId)
      } else if (settings.templates?.length > 0) {
        setSelectedTemplateId(settings.templates[0].id)
      } else {
        setSelectedTemplateId('none')
        loadPreview() // Load without template
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
      setSelectedTemplateId('none')
      loadPreview()
    }
  }

  const loadPreview = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/preview-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, metadata, userId, adjustments, templateId: selectedTemplateId })
      })
      const result = await res.json()
      if (result.success) {
        setHtml(result.html)
      }
    } catch (err) {
      console.error('Failed to load preview:', err)
    } finally {
      setLoading(false)
    }
  }

  const applyAdjustments = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return

    const body = doc.body
    if (!body) return

    // Apply font size
    body.style.fontSize = `${adjustments.fontSize}pt`
    
    // Apply margins
    body.style.padding = `${adjustments.margins}in`
    
    // Apply section spacing
    doc.querySelectorAll('.section').forEach(el => {
      el.style.marginBottom = `${20 + adjustments.sectionSpacing}px`
    })
    
    // Apply item spacing
    doc.querySelectorAll('.item').forEach(el => {
      el.style.paddingTop = `${8 + adjustments.itemSpacing}px`
      el.style.paddingBottom = `${8 + adjustments.itemSpacing}px`
    })
    
    // Apply header spacing
    doc.querySelectorAll('.header').forEach(el => {
      el.style.marginBottom = `${20 + adjustments.headerSpacing}px`
    })
  }

  const handlePrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow.print()
    }
  }

  const handleGeneratePDF = async () => {
    setGenerating(true)
    try {
      // Get the edited HTML from the iframe
      const editedHtml = iframeRef.current?.contentDocument?.documentElement?.outerHTML || html
      
      const res = await fetch(`${API_URL}/api/generate-report-from-html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          html: editedHtml, 
          data, 
          metadata, 
          userId,
          adjustments,
          templateId: selectedTemplateId
        })
      })
      const result = await res.json()
      
      if (result.success && onGenerate) {
        onGenerate(result)
      }
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleResetAdjustments = () => {
    setAdjustments({
      headerSpacing: 0,
      sectionSpacing: 0,
      itemSpacing: 0,
      fontSize: 10,
      margins: 0.5
    })
  }

  const handleRefresh = () => {
    loadPreview()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Report Preview & Editor</h2>
              <p className="text-xs text-slate-500">Edit fields directly or adjust layout to fix overlaps</p>
            </div>
            {/* Template Selector */}
            <div className="flex items-center gap-2 ml-4">
              <label className="text-xs text-slate-500">Template:</label>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No Template (Default)</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdjustments(!showAdjustments)}
              className={`px-3 py-1.5 text-sm border rounded-md flex items-center gap-2 ${
                showAdjustments ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Adjust Layout
            </button>
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={handleGeneratePDF}
              disabled={generating}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Adjustments Panel */}
          {showAdjustments && (
            <div className="w-64 border-r border-slate-200 bg-slate-50 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-slate-700">Layout Adjustments</h3>
                <button
                  onClick={handleResetAdjustments}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Reset
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Font Size */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Font Size: {adjustments.fontSize}pt
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="14"
                    step="0.5"
                    value={adjustments.fontSize}
                    onChange={(e) => setAdjustments({ ...adjustments, fontSize: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Margins */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Page Margins: {adjustments.margins}"
                  </label>
                  <input
                    type="range"
                    min="0.25"
                    max="1"
                    step="0.05"
                    value={adjustments.margins}
                    onChange={(e) => setAdjustments({ ...adjustments, margins: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Header Spacing */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Header Spacing: {adjustments.headerSpacing > 0 ? '+' : ''}{adjustments.headerSpacing}px
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="30"
                    step="1"
                    value={adjustments.headerSpacing}
                    onChange={(e) => setAdjustments({ ...adjustments, headerSpacing: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Section Spacing */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Section Spacing: {adjustments.sectionSpacing > 0 ? '+' : ''}{adjustments.sectionSpacing}px
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="30"
                    step="1"
                    value={adjustments.sectionSpacing}
                    onChange={(e) => setAdjustments({ ...adjustments, sectionSpacing: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Item Spacing */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Item Spacing: {adjustments.itemSpacing > 0 ? '+' : ''}{adjustments.itemSpacing}px
                  </label>
                  <input
                    type="range"
                    min="-5"
                    max="15"
                    step="1"
                    value={adjustments.itemSpacing}
                    onChange={(e) => setAdjustments({ ...adjustments, itemSpacing: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  💡 <strong>Tip:</strong> If text overlaps, try reducing font size or increasing section/item spacing.
                </p>
              </div>
            </div>
          )}

          {/* Preview Area */}
          <div className="flex-1 overflow-auto bg-slate-200 p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-slate-600">Loading preview...</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto shadow-2xl" style={{ width: '8.5in', minHeight: '11in', background: 'white' }}>
                <iframe
                  ref={iframeRef}
                  srcDoc={html}
                  className="w-full border-0"
                  style={{ minHeight: '11in' }}
                  title="Report Preview"
                  onLoad={() => applyAdjustments()}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer with instructions */}
        <div className="p-2 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-blue-400"></span>
                Click any blue-bordered field to edit text
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Use "Adjust Layout" to fix overlapping text
              </span>
            </div>
            <span>Changes are applied when you Generate PDF</span>
          </div>
        </div>
      </div>
    </div>
  )
}
