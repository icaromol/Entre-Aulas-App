import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
  allowedRole?: 'teacher' | 'student'
}

export function AuthGuard({ children, allowedRole }: AuthGuardProps) {
  const { user, profile, loading } = useAuth()
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

  if (allowedRole && profile?.role !== allowedRole) {
    return <Navigate to={profile?.role === 'teacher' ? '/professor' : '/aluno'} replace />
  }

  // Aluno sem registro na tabela students (cadastro sem convite)
  if (
    profile.role === 'student' &&
    profile.studentId === null &&
    location.pathname !== '/aluno/pendente'
  ) {
    return <Navigate to="/aluno/pendente" replace />
  }

  return <>{children}</>
}