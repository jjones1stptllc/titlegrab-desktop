import { useState, useEffect } from 'react'

const API_URL = 'http://127.0.0.1:3000'

export default function AdminPanel() {
  const [costData, setCostData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [availableMonths, setAvailableMonths] = useState([])
  const [showAddCost, setShowAddCost] = useState(false)
  const [newCost, setNewCost] = useState({ service: '', description: '', cost: '' })

  useEffect(() => {
    loadMonths()
    loadCosts()
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      loadCosts(selectedMonth)
    }
  }, [selectedMonth])

  const loadMonths = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/costs/months`)
      const months = await res.json()
      setAvailableMonths(months)
      if (months.length > 0 && !selectedMonth) {
        setSelectedMonth(months[0])
      }
    } catch (err) {
      console.error('Failed to load months:', err)
    }
  }

  const loadCosts = async (month = '') => {
    try {
      setLoading(true)
      const url = month 
        ? `${API_URL}/api/admin/costs?month=${month}`
        : `${API_URL}/api/admin/costs`
      const res = await fetch(url)
      const data = await res.json()
      setCostData(data)
    } catch (err) {
      console.error('Failed to load costs:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCost = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/api/admin/costs/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCost)
      })
      const data = await res.json()
      if (data.success) {
        setShowAddCost(false)
        setNewCost({ service: '', description: '', cost: '' })
        loadCosts(selectedMonth)
        loadMonths()
      }
    } catch (err) {
      console.error('Failed to add cost:', err)
    }
  }

  const handleExport = async (format) => {
    window.open(`${API_URL}/api/admin/costs/export?format=${format}`, '_blank')
  }

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0
    return num < 0.01 ? `$${num.toFixed(6)}` : `$${num.toFixed(2)}`
  }

  if (loading && !costData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">💰 Cost Tracking</h2>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Time</option>
            {availableMonths.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
          <button
            onClick={() => handleExport('csv')}
            className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-md"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {costData?.summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <p className="text-blue-100 text-xs uppercase tracking-wide">API Costs</p>
            <p className="text-2xl font-bold">{formatCurrency(costData.summary.totalCost)}</p>
            <p className="text-blue-200 text-xs mt-1">{costData.summary.totalCalls} API calls</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-4 text-white">
            <p className="text-emerald-100 text-xs uppercase tracking-wide">Total (w/ Fixed)</p>
            <p className="text-2xl font-bold">{formatCurrency(costData.summary.grandTotal)}</p>
            <p className="text-emerald-200 text-xs mt-1">+{formatCurrency(costData.summary.totalFixed)} fixed</p>
          </div>
        </div>
      )}

      {/* Cost by Service */}
      {costData?.byService && Object.keys(costData.byService).length > 0 && (
        <section className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-semibold text-slate-700 mb-3">By Service</h3>
          <div className="space-y-2">
            {Object.entries(costData.byService).map(([service, data]) => (
              <div key={service} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <div>
                  <p className="font-medium text-slate-700 text-sm">{service}</p>
                  <p className="text-xs text-slate-500">{data.calls} calls</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{formatCurrency(data.cost)}</p>
                  {data.inputTokens > 0 && (
                    <p className="text-xs text-slate-500">
                      {data.inputTokens.toLocaleString()} in / {data.outputTokens.toLocaleString()} out
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fixed Costs */}
      {costData?.fixedCosts && (
        <section className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-semibold text-slate-700 mb-3">Fixed Monthly Costs</h3>
          <div className="space-y-2">
            {Object.entries(costData.fixedCosts).map(([name, cost]) => (
              <div key={name} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <span className="text-sm text-slate-700">{name.replace(/-/g, ' ')}</span>
                <span className="font-medium text-slate-800">{formatCurrency(cost)}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAddCost(true)}
            className="mt-3 w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200"
          >
            + Add Manual Cost Entry
          </button>
        </section>
      )}

      {/* Daily Breakdown */}
      {costData?.byDay?.length > 0 && (
        <section className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-semibold text-slate-700 mb-3">Daily Usage</h3>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {costData.byDay.map(day => (
              <div key={day.date} className="flex items-center justify-between py-1 px-2 hover:bg-slate-100 rounded text-sm">
                <span className="text-slate-600">{day.date}</span>
                <span className="text-slate-500">{day.calls} calls</span>
                <span className="font-medium text-slate-700">{formatCurrency(day.cost)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Logs */}
      {costData?.recentLogs?.length > 0 && (
        <section className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-semibold text-slate-700 mb-3">Recent API Calls</h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {costData.recentLogs.slice(0, 20).map(log => (
              <div key={log.id} className="p-2 bg-white rounded border border-slate-200 text-xs">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">{log.service}</span>
                  <span className="text-slate-500">{formatCurrency(log.cost)}</span>
                </div>
                <div className="flex justify-between text-slate-400 mt-1">
                  <span>{log.operation}</span>
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                {log.inputTokens > 0 && (
                  <div className="text-slate-400 mt-1">
                    Tokens: {log.inputTokens} in / {log.outputTokens} out
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* No Data State */}
      {(!costData?.recentLogs || costData.recentLogs.length === 0) && (
        <div className="text-center py-8 text-slate-500">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No API usage recorded yet</p>
          <p className="text-xs mt-1">Costs will appear here as you process documents</p>
        </div>
      )}

      {/* Add Cost Modal */}
      {showAddCost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Add Manual Cost Entry</h3>
            <form onSubmit={handleAddCost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Service/Category</label>
                <input
                  type="text"
                  value={newCost.service}
                  onChange={(e) => setNewCost({ ...newCost, service: e.target.value })}
                  placeholder="e.g., domain-renewal, hosting"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>
                <input
                  type="text"
                  value={newCost.description}
                  onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                  placeholder="e.g., Annual domain renewal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newCost.cost}
                  onChange={(e) => setNewCost({ ...newCost, cost: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddCost(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Cost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
