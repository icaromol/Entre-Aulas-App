import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/auth/AuthGuard'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import TeacherPage from '@/pages/TeacherPage'
import StudentPage from '@/pages/StudentPage'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redireciona raiz para login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Rotas públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />

        {/* Rotas protegidas */}
        <Route
          path="/professor"
          element={
            <AuthGuard allowedRole="teacher">
              <TeacherPage />
            </AuthGuard>
          }
        />
        <Route
          path="/aluno"
          element={
            <AuthGuard allowedRole="student">
              <StudentPage />
            </AuthGuard>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}