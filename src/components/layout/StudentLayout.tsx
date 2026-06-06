import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { MdCalendarToday, MdLibraryMusic, MdOutlineFlag, MdHistory } from 'react-icons/md'

interface StudentLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { label: 'Hoje',       path: '/aluno/hoje',       Icon: MdCalendarToday },
  { label: 'Repertório', path: '/aluno/repertorio',  Icon: MdLibraryMusic },
  { label: 'Tarefas',    path: '/aluno/metas',       Icon: MdOutlineFlag },
  { label: 'Histórico',  path: '/aluno/historico',   Icon: MdHistory },
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
          {navItems.map(({ label, path, Icon }) => {
            const active = location.pathname.startsWith(path)
            return (
              <Link
                key={path}
                to={path}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
              >
                <Icon size={22} color={active ? '#1E3A5F' : '#9CA3AF'} />
                <span className={`text-[10px] font-medium ${active ? 'text-[#1E3A5F]' : 'text-gray-400'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
