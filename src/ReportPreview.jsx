import { useState, useEffect, useRef } from 'react'

const API_URL = 'http://23.31.100.76'

export default function ReportPreview({ data, metadata, userId = 'default', onClose, onGenerate }) {
  const [editableData, setEditableData] = useState(data)
  const [editableMetadata, setEditableMetadata] = useState(metadata)
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('edit') // 'edit' or 'preview'
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('none')
  const iframeRef = useRef(null)

  // Hide BrowserView when modal opens, show when it closes
  useEffect(() => {
    window.electronAPI?.hideBrowser?.()
    return () => {
      window.electronAPI?.showBrowser?.()
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    if (activeTab === 'preview') {
      loadPreview()
    }
  }, [activeTab, editableData, editableMetadata, selectedTemplateId])

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/${userId}`)
      const settings = await res.json()
      setTemplates(settings.templates || [])
      if (settings.defaultTemplateId) {
        setSelectedTemplateId(settings.defaultTemplateId)
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPreview = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/preview-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: editableData, 
          metadata: editableMetadata, 
          userId, 
          templateId: selectedTemplateId 
        })
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

  const handleGeneratePDF = async () => {
    setGenerating(true)
    try {
      // Merge metadata and data together as the server expects
      const reportData = {
        ...editableMetadata,
        ...editableData,
        userId,
        templateId: selectedTemplateId
      }
      
      // Use IPC to generate report (opens save dialog)
      const result = await window.electronAPI.generateReport(reportData)
      
      if (result.success) {
        if (onGenerate) {
          onGenerate(result)
        }
        onClose() // Close the modal after successful generation
      } else {
        console.error('Failed to generate PDF:', result.error)
        alert('Failed to generate PDF: ' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert('Failed to generate PDF: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const updateDeed = (index, field, value) => {
    setEditableData(prev => ({
      ...prev,
      deeds: prev.deeds.map((d, i) => i === index ? { ...d, [field]: value } : d)
    }))
  }

  const updateDOT = (index, field, value) => {
    setEditableData(prev => ({
      ...prev,
      deedsOfTrust: prev.deedsOfTrust.map((d, i) => i === index ? { ...d, [field]: value } : d)
    }))
  }

  const updateJudgment = (index, field, value) => {
    setEditableData(prev => ({
      ...prev,
      judgments: prev.judgments.map((j, i) => i === index ? { ...j, [field]: value } : j)
    }))
  }

  const updateLien = (index, field, value) => {
    setEditableData(prev => ({
      ...prev,
      liens: prev.liens.map((l, i) => i === index ? { ...l, [field]: value } : l)
    }))
  }

  const deleteItem = (type, index) => {
    setEditableData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }))
  }

  const totalItems = (editableData.deeds?.length || 0) + 
                     (editableData.deedsOfTrust?.length || 0) + 
                     (editableData.judgments?.length || 0) + 
                     (editableData.liens?.length || 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Report Editor</h2>
              <p className="text-sm text-gray-500">{totalItems} items extracted • Edit before generating</p>
            </div>
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'edit' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ✏️ Edit Data
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'preview' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                👁️ Preview
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="none">No Template</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={handleGeneratePDF}
              disabled={generating || totalItems === 0}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>📄 Generate PDF</>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'edit' ? (
            <div className="h-full overflow-auto p-6 bg-gray-50">
              {/* Metadata Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  📋 Report Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client/Property</label>
                    <input
                      type="text"
                      value={editableMetadata.client || ''}
                      onChange={(e) => setEditableMetadata(prev => ({ ...prev, client: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Client name or property address"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Thru Date</label>
                    <input
                      type="date"
                      value={editableMetadata.thruDate || ''}
                      onChange={(e) => setEditableMetadata(prev => ({ ...prev, thruDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Deeds */}
              {editableData.deeds?.length > 0 && (
                <EditSection 
                  title="Deeds" 
                  icon="📜" 
                  items={editableData.deeds}
                  fields={['grantor', 'grantee', 'book', 'page', 'date', 'consideration']}
                  onUpdate={updateDeed}
                  onDelete={(i) => deleteItem('deeds', i)}
                  color="blue"
                />
              )}

              {/* Deeds of Trust */}
              {editableData.deedsOfTrust?.length > 0 && (
                <EditSection 
                  title="Deeds of Trust" 
                  icon="🏦" 
                  items={editableData.deedsOfTrust}
                  fields={['grantor', 'beneficiary', 'trustee', 'book', 'page', 'date', 'amount']}
                  onUpdate={updateDOT}
                  onDelete={(i) => deleteItem('deedsOfTrust', i)}
                  color="emerald"
                />
              )}

              {/* Judgments */}
              {editableData.judgments?.length > 0 && (
                <EditSection 
                  title="Judgments" 
                  icon="⚖️" 
                  items={editableData.judgments}
                  fields={['plaintiff', 'defendant', 'book', 'page', 'date', 'amount', 'case']}
                  onUpdate={updateJudgment}
                  onDelete={(i) => deleteItem('judgments', i)}
                  color="amber"
                />
              )}

              {/* Liens */}
              {editableData.liens?.length > 0 && (
                <EditSection 
                  title="Liens" 
                  icon="🔗" 
                  items={editableData.liens}
                  fields={['type', 'creditor', 'debtor', 'book', 'page', 'date', 'amount']}
                  onUpdate={updateLien}
                  onDelete={(i) => deleteItem('liens', i)}
                  color="rose"
                />
              )}

              {totalItems === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="text-lg font-medium">No data extracted yet</p>
                  <p className="text-sm mt-1">Capture some documents first, then come back to edit and generate your report</p>
                </div>
              )}
            </div>
          ) : (
            /* Preview Tab */
            <div className="h-full overflow-auto p-6 bg-gray-100">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-600">Generating preview...</p>
                  </div>
                </div>
              ) : html ? (
                <div className="mx-auto bg-white shadow-xl rounded-lg overflow-hidden" style={{ width: '8.5in', minHeight: '11in' }}>
                  <iframe
                    ref={iframeRef}
                    srcDoc={html}
                    className="w-full border-0"
                    style={{ minHeight: '11in' }}
                    title="Report Preview"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <p className="text-lg">No preview available</p>
                    <p className="text-sm mt-1">Add some data in the Edit tab first</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Editable Section Component
function EditSection({ title, icon, items, fields, onUpdate, onDelete, color }) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    rose: 'border-rose-200 bg-rose-50/50'
  }

  const headerColors = {
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700'
  }

  const fieldLabels = {
    grantor: 'Grantor',
    grantee: 'Grantee',
    beneficiary: 'Beneficiary',
    trustee: 'Trustee',
    plaintiff: 'Plaintiff',
    defendant: 'Defendant',
    creditor: 'Creditor',
    debtor: 'Debtor',
    book: 'Book',
    page: 'Page',
    date: 'Date',
    amount: 'Amount',
    consideration: 'Consideration',
    case: 'Case #',
    type: 'Type'
  }

  return (
    <div className={`bg-white rounded-xl border ${colorClasses[color]} p-5 mb-4`}>
      <h3 className={`font-semibold mb-4 flex items-center gap-2 ${headerColors[color]}`}>
        {icon} {title} ({items.length})
      </h3>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 relative group">
            <button
              onClick={() => onDelete(index)}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete item"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <div className="grid grid-cols-3 gap-3">
              {fields.map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{fieldLabels[field]}</label>
                  <input
                    type="text"
                    value={item[field] || ''}
                    onChange={(e) => onUpdate(index, field, e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={fieldLabels[field]}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
