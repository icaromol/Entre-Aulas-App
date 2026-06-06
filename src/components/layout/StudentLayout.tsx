import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Avatar from 'boring-avatars'
import { useAuth } from '@/hooks/useAuth'
import { MdCalendarToday, MdLibraryMusic, MdOutlineFlag, MdHistory, MdLogout } from 'react-icons/md'

const AVATAR_COLORS = ['#1E3A5F', '#4A90C4', '#D6E4F0', '#F5F7FA', '#FFFFFF']

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
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSignOut() {
    setShowConfirm(false)
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Modal confirmação de logout */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <h2 className="text-base font-bold text-[#1E3A5F] mb-1">Quer sair?</h2>
            <p className="text-sm text-gray-400 mb-5">Você será desconectado da sua conta.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
              >
                Sair e fazer logout
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-[#4A90C4] transition"
              >
                Permanecer conectado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header simples */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 h-14 grid grid-cols-3 items-center">
          {/* Esquerda — perfil */}
          <div className="flex items-center gap-2.5">
            <div className="rounded-full overflow-hidden shrink-0">
              <Avatar
                size={32}
                name={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`}
                variant="beam"
                colors={AVATAR_COLORS}
              />
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold text-gray-700 truncate">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Centro — logo */}
          <span className="text-base font-bold text-[#1E3A5F] text-center">Entre Aulas</span>

          {/* Direita — logout */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowConfirm(true)}
              className="text-gray-400 hover:text-gray-600 transition"
              aria-label="Sair"
            >
              <MdLogout size={20} />
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
