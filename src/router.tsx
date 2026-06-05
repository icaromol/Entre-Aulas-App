import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/auth/AuthGuard'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import StudentsPage from '@/pages/teacher/StudentsPage'
import NewStudentPage from '@/pages/teacher/NewStudentPage'
import StudentPage from '@/pages/StudentPage'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />

        {/* Professor */}
        <Route
          path="/professor"
          element={
            <AuthGuard allowedRole="teacher">
              <Navigate to="/professor/alunos" replace />
            </AuthGuard>
          }
        />
        <Route
          path="/professor/alunos"
          element={
            <AuthGuard allowedRole="teacher">
              <StudentsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/professor/alunos/novo"
          element={
            <AuthGuard allowedRole="teacher">
              <NewStudentPage />
            </AuthGuard>
          }
        />

        {/* Aluno */}
        <Route
          path="/aluno"
          element={
            <AuthGuard allowedRole="student">
              <Navigate to="/aluno/hoje" replace />
            </AuthGuard>
          }
        />
        <Route
          path="/aluno/hoje"
          element={
            <AuthGuard allowedRole="student">
              <StudentPage />
            </AuthGuard>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}