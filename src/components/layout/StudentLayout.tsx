import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface StudentLayoutProps {
  children: React.ReactNode
}

const navItems = [
  {
    label: 'Hoje',
    path: '/aluno/hoje',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : '#9CA3AF'} strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    label: 'Repertório',
    path: '/aluno/repertorio',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : '#9CA3AF'} strokeWidth={2}>
        <path d="M9 19V6l12-3v13"/>
        <circle cx="6" cy="19" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    ),
  },
  {
    label: 'Metas',
    path: '/aluno/metas',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : '#9CA3AF'} strokeWidth={2}>
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>
      </svg>
    ),
  },
  {
    label: 'Histórico',
    path: '/aluno/historico',
    icon: (active: boolean) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : '#9CA3AF'} strokeWidth={2}>
        <path d="M12 8v4l3 3"/>
        <circle cx="12" cy="12" r="9"/>
      </svg>
    ),
  },
]

export function StudentLayout({ children }: StudentLayoutProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Header simples */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 h-14 flex items-center justify-between">
          <span className="text-base font-bold text-[#1E3A5F]">Entre Aulas</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {profile?.first_name}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="px-4 py-5">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-10">
        <div className="flex">
          {navItems.map(item => {
            const active = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
              >
                {item.icon(active)}
                <span className={`text-[10px] font-medium ${active ? 'text-[#1E3A5F]' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  )
}