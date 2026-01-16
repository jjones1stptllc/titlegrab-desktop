import { useState, useEffect, useRef } from 'react'

const API_URL = 'http://127.0.0.1:3000'

export default function Settings({ userId = 'default' }) {
  const [settings, setSettings] = useState({})
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // Template editor state
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    file: null,
    logo: null,
    fieldMappings: []
  })
  const [editorStep, setEditorStep] = useState(1) // 1=basics, 2=field mapping
  
  const templateFileRef = useRef(null)
  const templateLogoRef = useRef(null)

  useEffect(() => {
    loadSettings()
  }, [userId])

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/${userId}`)
      const data = await res.json()
      setSettings(data)
      setTemplates(data.templates || [])
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const openNewTemplate = () => {
    setEditingTemplate(null)
    setTemplateForm({ name: '', file: null, logo: null, fieldMappings: [] })
    setEditorStep(1)
    setShowTemplateModal(true)
  }

  const openEditTemplate = (template) => {
    setEditingTemplate(template)
    setTemplateForm({
      name: template.name,
      file: null, // existing file
      logo: null, // existing logo
      fieldMappings: template.fieldMappings || []
    })
    setEditorStep(2) // Go straight to field mapping for existing templates
    setShowTemplateModal(true)
  }

  const handleTemplateFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      setTemplateForm({ ...templateForm, file })
    } else {
      showMessage('error', 'Please select a PDF file')
    }
  }

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setTemplateForm({ ...templateForm, logo: file })
    } else {
      showMessage('error', 'Please select an image file')
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      showMessage('error', 'Please enter a template name')
      return
    }
    if (!editingTemplate && !templateForm.file) {
      showMessage('error', 'Please upload a PDF template')
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('templateName', templateForm.name)
      formData.append('fieldMappings', JSON.stringify(templateForm.fieldMappings))
      
      if (editingTemplate) {
        formData.append('templateId', editingTemplate.id)
      }
      if (templateForm.file) {
        formData.append('template', templateForm.file)
      }
      if (templateForm.logo) {
        formData.append('logo', templateForm.logo)
      }

      const res = await fetch(`${API_URL}/api/templates`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (data.success) {
        showMessage('success', editingTemplate ? 'Template updated!' : 'Template created!')
        setShowTemplateModal(false)
        loadSettings()
      } else {
        showMessage('error', data.error || 'Failed to save template')
      }
    } catch (err) {
      showMessage('error', 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Delete this template? This cannot be undone.')) return
    
    try {
      const res = await fetch(`${API_URL}/api/templates/${templateId}?userId=${userId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        showMessage('success', 'Template deleted')
        loadSettings()
      }
    } catch (err) {
      showMessage('error', 'Failed to delete template')
    }
  }

  const handleSavePreferences = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/settings/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: settings.companyName,
          defaultClient: settings.defaultClient,
          autoSaveReports: settings.autoSaveReports,
          defaultTemplateId: settings.defaultTemplateId
        })
      })
      const data = await res.json()
      if (data.success) showMessage('success', 'Preferences saved!')
    } catch (err) {
      showMessage('error', 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const availableFields = [
    { id: 'propertyAddress', label: 'Property Address', category: 'Property' },
    { id: 'ownerName', label: 'Current Owner Name', category: 'Property' },
    { id: 'parcelId', label: 'Parcel ID / Tax Map', category: 'Property' },
    { id: 'clientName', label: 'Client Name', category: 'Header' },
    { id: 'orderNumber', label: 'Order Number', category: 'Header' },
    { id: 'countyCity', label: 'County/City', category: 'Header' },
    { id: 'searchDate', label: 'Search Date', category: 'Header' },
    { id: 'deeds', label: 'Deeds Section', category: 'Documents' },
    { id: 'deedsOfTrust', label: 'Deeds of Trust Section', category: 'Documents' },
    { id: 'judgments', label: 'Judgments Section', category: 'Documents' },
    { id: 'liens', label: 'Liens Section', category: 'Documents' },
    { id: 'taxes', label: 'Tax Information', category: 'Documents' },
    { id: 'notes', label: 'Notes/Comments', category: 'Other' },
  ]

  const addFieldMapping = (fieldId) => {
    if (templateForm.fieldMappings.find(m => m.fieldId === fieldId)) return
    setTemplateForm({
      ...templateForm,
      fieldMappings: [...templateForm.fieldMappings, {
        fieldId, page: 1, x: 50, y: 100 + (templateForm.fieldMappings.length * 30), width: 200
      }]
    })
  }

  const updateFieldMapping = (fieldId, updates) => {
    setTemplateForm({
      ...templateForm,
      fieldMappings: templateForm.fieldMappings.map(m =>
        m.fieldId === fieldId ? { ...m, ...updates } : m
      )
    })
  }

  const removeFieldMapping = (fieldId) => {
    setTemplateForm({
      ...templateForm,
      fieldMappings: templateForm.fieldMappings.filter(m => m.fieldId !== fieldId)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {/* Toast */}
      {message.text && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.text}
        </div>
      )}

      <h2 className="text-lg font-bold text-slate-800">Settings</h2>

      {/* Report Templates Section */}
      <section className="bg-slate-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="font-semibold text-slate-700">Report Templates</h3>
          </div>
          <button
            onClick={openNewTemplate}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + Add Template
          </button>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Create multiple templates for different report types. Each template can have its own PDF layout, logo, and field positions.
        </p>

        {templates.length === 0 ? (
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-500 mb-2">No templates yet</p>
            <button onClick={openNewTemplate} className="text-blue-600 hover:text-blue-700 font-medium">
              Create your first template
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {templates.map(template => (
              <div 
                key={template.id} 
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer group"
                onClick={() => openEditTemplate(template)}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-slate-700">{template.name}</p>
                    <p className="text-xs text-slate-400">
                      {template.fieldMappings?.length || 0} fields • {template.hasLogo ? 'Has logo' : 'No logo'}
                    </p>
                  </div>
                  {settings.defaultTemplateId === template.id && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Default</span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setSettings({ ...settings, defaultTemplateId: template.id })}
                    className={`px-2 py-1 text-xs rounded ${
                      settings.defaultTemplateId === template.id ? 'text-green-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="Set as default"
                  >
                    {settings.defaultTemplateId === template.id ? '★' : '☆'}
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-600 rounded"
                    title="Delete template"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Preferences Section */}
      <section className="bg-slate-50 rounded-lg p-4">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Preferences
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Company Name</label>
            <input
              type="text"
              value={settings.companyName || ''}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              placeholder="Your Company Name"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Default Client Name</label>
            <input
              type="text"
              value={settings.defaultClient || ''}
              onChange={(e) => setSettings({ ...settings, defaultClient: e.target.value })}
              placeholder="Pre-fill client name on new reports"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoSave"
              checked={settings.autoSaveReports || false}
              onChange={(e) => setSettings({ ...settings, autoSaveReports: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="autoSave" className="text-sm text-slate-600">Auto-save reports to Downloads folder</label>
          </div>
        </div>

        <button
          onClick={handleSavePreferences}
          disabled={saving}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-md"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </section>

      {/* Template Editor Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h3>
                <p className="text-sm text-slate-500">
                  Step {editorStep} of 2: {editorStep === 1 ? 'Basic Info' : 'Field Mapping'}
                </p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 1: Basic Info */}
            {editorStep === 1 && (
              <div className="p-6 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      placeholder="e.g., Full Title Search, Current Owner Search"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">PDF Template *</label>
                    <div 
                      onClick={() => templateFileRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50"
                    >
                      {templateForm.file ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
                          </svg>
                          <span className="text-slate-700">{templateForm.file.name}</span>
                        </div>
                      ) : editingTemplate ? (
                        <p className="text-slate-600">Current template: <strong>{editingTemplate.fileName}</strong><br/>
                        <span className="text-sm text-slate-400">Click to replace</span></p>
                      ) : (
                        <>
                          <svg className="w-10 h-10 mx-auto text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-slate-600">Click to upload PDF template</p>
                        </>
                      )}
                    </div>
                    <input ref={templateFileRef} type="file" accept=".pdf" onChange={handleTemplateFileSelect} className="hidden" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Logo (Optional)</label>
                    <div 
                      onClick={() => templateLogoRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50"
                    >
                      {templateForm.logo ? (
                        <div className="flex items-center justify-center gap-2">
                          <img src={URL.createObjectURL(templateForm.logo)} alt="Logo" className="h-10 object-contain" />
                          <span className="text-slate-600">{templateForm.logo.name}</span>
                        </div>
                      ) : editingTemplate?.hasLogo ? (
                        <p className="text-slate-600">Logo uploaded ✓ <span className="text-sm text-slate-400">(click to replace)</span></p>
                      ) : (
                        <p className="text-slate-500 text-sm">Click to upload logo (PNG, JPG)</p>
                      )}
                    </div>
                    <input ref={templateLogoRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Field Mapping */}
            {editorStep === 2 && (
              <div className="flex flex-1 overflow-hidden">
                {/* Left: Available Fields */}
                <div className="w-56 border-r bg-slate-50 p-4 overflow-y-auto">
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">Available Fields</h4>
                  <p className="text-xs text-slate-500 mb-3">Click to add to template</p>
                  
                  {['Header', 'Property', 'Documents', 'Other'].map(category => (
                    <div key={category} className="mb-3">
                      <p className="text-xs font-medium text-slate-400 uppercase mb-1">{category}</p>
                      {availableFields.filter(f => f.category === category).map(field => (
                        <button
                          key={field.id}
                          onClick={() => addFieldMapping(field.id)}
                          disabled={templateForm.fieldMappings.find(m => m.fieldId === field.id)}
                          className={`w-full text-left px-2 py-1.5 text-xs rounded mb-1 ${
                            templateForm.fieldMappings.find(m => m.fieldId === field.id)
                              ? 'bg-green-100 text-green-700'
                              : 'bg-white hover:bg-blue-50 text-slate-700'
                          }`}
                        >
                          {templateForm.fieldMappings.find(m => m.fieldId === field.id) ? '✓ ' : '+ '}
                          {field.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Right: Mapped Fields */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <h4 className="font-semibold text-sm text-slate-700 mb-3">
                    Field Positions ({templateForm.fieldMappings.length} mapped)
                  </h4>

                  {templateForm.fieldMappings.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>No fields mapped yet</p>
                      <p className="text-sm">Click fields on the left to add them</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {templateForm.fieldMappings.map(mapping => {
                        const field = availableFields.find(f => f.id === mapping.fieldId)
                        return (
                          <div key={mapping.fieldId} className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm text-slate-700">{field?.label}</span>
                              <button onClick={() => removeFieldMapping(mapping.fieldId)} className="text-red-500 hover:text-red-700 text-xs">
                                Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div>
                                <label className="text-slate-500">Page</label>
                                <input type="number" min="1" value={mapping.page}
                                  onChange={(e) => updateFieldMapping(mapping.fieldId, { page: parseInt(e.target.value) || 1 })}
                                  className="w-full px-2 py-1 border rounded" />
                              </div>
                              <div>
                                <label className="text-slate-500">X</label>
                                <input type="number" value={mapping.x}
                                  onChange={(e) => updateFieldMapping(mapping.fieldId, { x: parseInt(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 border rounded" />
                              </div>
                              <div>
                                <label className="text-slate-500">Y</label>
                                <input type="number" value={mapping.y}
                                  onChange={(e) => updateFieldMapping(mapping.fieldId, { y: parseInt(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 border rounded" />
                              </div>
                              <div>
                                <label className="text-slate-500">Width</label>
                                <input type="number" value={mapping.width}
                                  onChange={(e) => updateFieldMapping(mapping.fieldId, { width: parseInt(e.target.value) || 100 })}
                                  className="w-full px-2 py-1 border rounded" />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between p-4 border-t bg-slate-50">
              <div>
                {editorStep === 2 && (
                  <button onClick={() => setEditorStep(1)} className="px-4 py-2 text-slate-600 hover:text-slate-800">
                    ← Back
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800">
                  Cancel
                </button>
                {editorStep === 1 ? (
                  <button
                    onClick={() => setEditorStep(2)}
                    disabled={!templateForm.name || (!editingTemplate && !templateForm.file)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300"
                  >
                    Next: Field Mapping →
                  </button>
                ) : (
                  <button onClick={handleSaveTemplate} disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400">
                    {saving ? 'Saving...' : 'Save Template'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
