import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
  allowedRole?: 'teacher' | 'student'
}

export function AuthGuard({ children, allowedRole }: AuthGuardProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRole && profile?.role !== allowedRole) {
    // Redireciona para a área correta se o role não bater
    return <Navigate to={profile?.role === 'teacher' ? '/professor' : '/aluno'} replace />
  }

  return <>{children}</>
}