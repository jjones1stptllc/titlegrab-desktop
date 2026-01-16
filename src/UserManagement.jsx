import { useState, useEffect } from 'react'

const API_URL = 'http://147.93.185.218'

export default function UserManagement({ onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`)
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    setError('')
    
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      
      const data = await res.json()
      
      if (data.success) {
        setShowAddUser(false)
        setNewUser({ email: '', password: '', name: '' })
        fetchUsers()
      } else {
        setError(data.error || 'Failed to create user')
      }
    } catch (err) {
      setError('Failed to create user')
    }
  }

  const handleDeleteUser = async (userId, email) => {
    if (!confirm(`Delete user ${email}?`)) return
    
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        fetchUsers()
      }
    } catch (err) {
      setError('Failed to delete user')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">👥 User Management</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {/* Add User Button */}
        <button
          onClick={() => setShowAddUser(true)}
          className="mb-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Add New User
        </button>

        {/* Add User Form */}
        {showAddUser && (
          <form onSubmit={handleAddUser} className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-white mb-3">Create New User</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                className="bg-gray-600 text-white px-3 py-2 rounded"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                className="bg-gray-600 text-white px-3 py-2 rounded"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                className="bg-gray-600 text-white px-3 py-2 rounded"
                required
                minLength={6}
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                Create User
              </button>
              <button type="button" onClick={() => setShowAddUser(false)} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Users List */}
        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading users...</div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{user.name || user.email}</div>
                  <div className="text-sm text-gray-400">{user.email}</div>
                  <div className="text-xs text-gray-500">
                    Created: {new Date(user.createdAt).toLocaleDateString()}
                    {user.lastSignIn && ` | Last login: ${new Date(user.lastSignIn).toLocaleDateString()}`}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteUser(user.id, user.email)}
                  className="text-red-400 hover:text-red-300 px-3 py-1"
                >
                  Delete
                </button>
              </div>
            ))}
            
            {users.length === 0 && (
              <div className="text-gray-400 text-center py-8">No users found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
