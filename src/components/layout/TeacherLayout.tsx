import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface TeacherLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { label: 'Alunos', path: '/professor/alunos' },
  { label: 'Agenda', path: '/professor/agenda' },
]

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link to="/professor/alunos" className="text-base font-bold text-[#1E3A5F]">
            Entre Aulas
          </Link>

          {/* Nav central */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  location.pathname.startsWith(item.path)
                    ? 'bg-[#D6E4F0] text-[#1E3A5F]'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Usuário */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">
              {profile?.first_name} {profile?.last_name}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
            >
              Sair
            </button>
          </div>

        </div>

        {/* Nav mobile */}
        <div className="sm:hidden flex border-t border-gray-100">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 text-center py-2 text-xs font-medium transition ${
                location.pathname.startsWith(item.path)
                  ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]'
                  : 'text-gray-400'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}