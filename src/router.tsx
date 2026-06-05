import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/auth/AuthGuard'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import StudentsPage from '@/pages/teacher/StudentsPage'
import NewStudentPage from '@/pages/teacher/NewStudentPage'
import StudentProfilePage from '@/pages/teacher/StudentProfilePage'
import EditStudentPage from '@/pages/teacher/EditStudentPage'
import NewPiecePage from '@/pages/teacher/NewPiecePage'
import PieceDetailPage from '@/pages/teacher/PieceDetailPage'
import NewExercisePage from '@/pages/teacher/NewExercisePage'
import WeeklyPlanPage from '@/pages/teacher/WeeklyPlanPage'
import TodayPage from '@/pages/student/TodayPage'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />

        {/* Professor */}
        <Route path="/professor" element={<AuthGuard allowedRole="teacher"><Navigate to="/professor/alunos" replace /></AuthGuard>} />
        <Route path="/professor/alunos" element={<AuthGuard allowedRole="teacher"><StudentsPage /></AuthGuard>} />
        <Route path="/professor/alunos/novo" element={<AuthGuard allowedRole="teacher"><NewStudentPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId" element={<AuthGuard allowedRole="teacher"><StudentProfilePage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/editar" element={<AuthGuard allowedRole="teacher"><EditStudentPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/pecas/nova" element={<AuthGuard allowedRole="teacher"><NewPiecePage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/pecas/:pieceId" element={<AuthGuard allowedRole="teacher"><PieceDetailPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/exercicios/novo" element={<AuthGuard allowedRole="teacher"><NewExercisePage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/plano" element={<AuthGuard allowedRole="teacher"><WeeklyPlanPage /></AuthGuard>} />

        {/* Aluno */}
        <Route path="/aluno" element={<AuthGuard allowedRole="student"><Navigate to="/aluno/hoje" replace /></AuthGuard>} />
        <Route path="/aluno/hoje" element={<AuthGuard allowedRole="student"><TodayPage /></AuthGuard>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}