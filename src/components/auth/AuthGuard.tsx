import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
  allowedRole?: 'teacher' | 'student'
}

export function AuthGuard({ children, allowedRole }: AuthGuardProps) {
  const { user, profile, loading, mode } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  // Professor sem modo escolhido → tela de seleção (sempre, na primeira entrada)
  if (
    profile.role === 'teacher' &&
    mode === null &&
    location.pathname !== '/modo'
  ) {
    return <Navigate to="/modo" replace />
  }

  // Professor tentando acessar área de aluno sem ter escolhido modo estudante
  if (allowedRole === 'student' && profile.role === 'teacher') {
    if (mode !== 'student') return <Navigate to="/modo" replace />
    return <>{children}</>
  }

  if (allowedRole && profile.role !== allowedRole) {
    return <Navigate to={profile.role === 'teacher' ? '/professor' : '/aluno'} replace />
  }

  return <>{children}</>
}