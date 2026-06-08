import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { MdPeople, MdLogout } from 'react-icons/md'

interface TeacherLayoutProps {
  children: React.ReactNode
}

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', profile.id)
      .single()
      .then(({ data: teacher }) => {
        if (!teacher) return
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacher.id)
          .eq('status', 'pending')
          .then(({ count }) => setPendingCount(count ?? 0))
      })
  }, [profile, location.pathname])

  async function handleSignOut() {
    setShowConfirm(false)
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">

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

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link to="/professor/alunos" className="flex items-center">
            <img src="/estudamus_logo.png" alt="estudamus" className="h-[22px]" />
          </Link>

          {/* Nav central */}
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              to="/professor/alunos"
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                location.pathname.startsWith('/professor/alunos')
                  ? 'bg-[#D6E4F0] text-[#1E3A5F]'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <MdPeople size={15} />
              Alunos
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#4A90C4]" />
              )}
            </Link>
          </nav>

          {/* Usuário */}
          <div className="flex items-center gap-8">
            <span className="text-sm text-gray-500 hidden sm:block">
              {profile?.first_name} {profile?.last_name}
            </span>
            <button
              onClick={() => setShowConfirm(true)}
              className="text-gray-400 hover:text-gray-600 transition"
              aria-label="Sair"
            >
              <MdLogout size={20} />
            </button>
          </div>

        </div>

        {/* Nav mobile */}
        <div className="sm:hidden flex border-t border-gray-100">
          <Link
            to="/professor/alunos"
            className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition ${
              location.pathname.startsWith('/professor/alunos')
                ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]'
                : 'text-gray-400'
            }`}
          >
            <MdPeople size={14} />
            Alunos
            {pendingCount > 0 && (
              <span className="absolute top-1 right-[calc(50%-20px)] w-2.5 h-2.5 rounded-full bg-[#4A90C4]" />
            )}
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}