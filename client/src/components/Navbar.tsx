import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-[#1a1a1a] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <Link to="/dashboard" className="text-orange-500 font-bold text-xl tracking-tight">
        Readapt
      </Link>
      <div className="flex items-center gap-6">
        <Link to="/library" className="text-gray-400 hover:text-white transition-colors text-sm">
          Library
        </Link>
        <span className="text-gray-600 text-sm">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-red-400 transition-colors text-sm"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
