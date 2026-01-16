import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const API_URL = 'http://147.93.185.218'

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
  const [companyLogo, setCompanyLogo] = useState(null)
  const [companyLogoPreview, setCompanyLogoPreview] = useState(null)
  
  const templateFileRef = useRef(null)
  const templateLogoRef = useRef(null)
  const companyLogoRef = useRef(null)

  useEffect(() => {
    loadSettings()
  }, [userId])

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/${userId}`)
      const data = await res.json()
      setSettings(data)
      setTemplates(data.templates || [])
      if (data.companyLogoUrl) {
        setCompanyLogoPreview(data.companyLogoUrl)
      }
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
    window.electronAPI?.hideBrowser()
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
    window.electronAPI?.hideBrowser()
  }

  const closeTemplateModal = () => {
    setShowTemplateModal(false)
    window.electronAPI?.showBrowser()
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

  const handleCompanyLogoSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      showMessage('error', 'Please select an image file')
      return
    }
    
    setCompanyLogo(file)
    setCompanyLogoPreview(URL.createObjectURL(file))
    
    // Upload immediately
    const formData = new FormData()
    formData.append('userId', userId)
    formData.append('logo', file)
    
    try {
      const res = await fetch(`${API_URL}/api/settings/logo`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        showMessage('success', 'Logo uploaded!')
        setCompanyLogoPreview(data.logoUrl)
      } else {
        showMessage('error', 'Failed to upload logo')
      }
    } catch (err) {
      showMessage('error', 'Failed to upload logo')
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
        closeTemplateModal()
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
            <label className="block text-sm font-medium text-slate-600 mb-1">Company Logo</label>
            <div 
              onClick={() => companyLogoRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 bg-white"
            >
              {companyLogoPreview ? (
                <div className="flex items-center justify-center gap-3">
                  <img src={companyLogoPreview} alt="Company Logo" className="h-12 object-contain" />
                  <span className="text-sm text-slate-500">Click to change</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-slate-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">Upload company logo (PNG, JPG)</span>
                </div>
              )}
            </div>
            <input ref={companyLogoRef} type="file" accept="image/*" onChange={handleCompanyLogoSelect} className="hidden" />
            <p className="text-xs text-slate-400 mt-1">This logo will appear on all your reports</p>
          </div>

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

      {/* Template Editor Modal - using Portal to escape container constraints */}
      {showTemplateModal && createPortal(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:99999}}>
          <div style={{backgroundColor:'white',borderRadius:'12px',width:'90%',maxWidth:'800px',maxHeight:'90vh',display:'flex',flexDirection:'column',margin:'16px'}}>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px',borderBottom:'1px solid #e2e8f0'}}>
              <div>
                <h3 style={{fontSize:'18px',fontWeight:'bold',color:'#1e293b',margin:0}}>
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h3>
                <p style={{fontSize:'14px',color:'#64748b',margin:'4px 0 0 0'}}>
                  Step {editorStep} of 2: {editorStep === 1 ? 'Basic Info' : 'Field Mapping'}
                </p>
              </div>
              <button onClick={closeTemplateModal} style={{background:'none',border:'none',cursor:'pointer',padding:'8px',color:'#94a3b8'}}>
                <svg style={{width:'24px',height:'24px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 1: Basic Info */}
            {editorStep === 1 && (
              <div style={{padding:'24px',overflowY:'auto',flex:1}}>
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  <div>
                    <label style={{display:'block',fontSize:'14px',fontWeight:'500',color:'#334155',marginBottom:'4px'}}>Template Name *</label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      placeholder="e.g., Full Title Search, Current Owner Search"
                      style={{width:'100%',padding:'8px 12px',border:'1px solid #cbd5e1',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}}
                    />
                  </div>

                  <div>
                    <label style={{display:'block',fontSize:'14px',fontWeight:'500',color:'#334155',marginBottom:'4px'}}>PDF Template *</label>
                    <div 
                      onClick={() => templateFileRef.current?.click()}
                      style={{border:'2px dashed #cbd5e1',borderRadius:'8px',padding:'24px',textAlign:'center',cursor:'pointer',backgroundColor:'#f8fafc'}}
                    >
                      {templateForm.file ? (
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                          <span style={{color:'#334155'}}>{templateForm.file.name}</span>
                        </div>
                      ) : editingTemplate ? (
                        <p style={{color:'#475569',margin:0}}>Current: <strong>{editingTemplate.fileName}</strong><br/>
                        <span style={{fontSize:'12px',color:'#94a3b8'}}>Click to replace</span></p>
                      ) : (
                        <p style={{color:'#475569',margin:0}}>Click to upload PDF template</p>
                      )}
                    </div>
                    <input ref={templateFileRef} type="file" accept=".pdf" onChange={handleTemplateFileSelect} style={{display:'none'}} />
                  </div>

                  <div>
                    <label style={{display:'block',fontSize:'14px',fontWeight:'500',color:'#334155',marginBottom:'4px'}}>Logo (Optional - PNG, JPG)</label>
                    <div 
                      onClick={() => templateLogoRef.current?.click()}
                      style={{border:'2px dashed #cbd5e1',borderRadius:'8px',padding:'16px',textAlign:'center',cursor:'pointer',backgroundColor:'#f8fafc'}}
                    >
                      {templateForm.logo ? (
                        <span style={{color:'#475569'}}>{templateForm.logo.name}</span>
                      ) : editingTemplate?.hasLogo ? (
                        <p style={{color:'#475569',margin:0}}>Logo uploaded ✓</p>
                      ) : (
                        <p style={{color:'#64748b',margin:0,fontSize:'14px'}}>Click to upload logo</p>
                      )}
                    </div>
                    <input ref={templateLogoRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{display:'none'}} />
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
            <div style={{display:'flex',justifyContent:'space-between',padding:'16px',borderTop:'1px solid #e2e8f0',backgroundColor:'#f8fafc'}}>
              <div>
                {editorStep === 2 && (
                  <button onClick={() => setEditorStep(1)} style={{padding:'8px 16px',color:'#475569',background:'none',border:'none',cursor:'pointer',fontSize:'14px'}}>
                    ← Back
                  </button>
                )}
              </div>
              <div style={{display:'flex',gap:'12px'}}>
                <button onClick={closeTemplateModal} style={{padding:'8px 16px',color:'#475569',background:'none',border:'none',cursor:'pointer',fontSize:'14px'}}>
                  Cancel
                </button>
                {editorStep === 1 ? (
                  <button
                    onClick={() => setEditorStep(2)}
                    disabled={!templateForm.name || (!editingTemplate && !templateForm.file)}
                    style={{padding:'8px 16px',backgroundColor:(!templateForm.name || (!editingTemplate && !templateForm.file))?'#cbd5e1':'#2563eb',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'14px'}}
                  >
                    Next: Field Mapping →
                  </button>
                ) : (
                  <button onClick={handleSaveTemplate} disabled={saving}
                    style={{padding:'8px 16px',backgroundColor:saving?'#86efac':'#16a34a',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'14px'}}>
                    {saving ? 'Saving...' : 'Save Template'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
