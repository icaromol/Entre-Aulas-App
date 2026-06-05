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
import ExerciseDetailPage from '@/pages/teacher/ExerciseDetailPage'
import WeeklyPlanPage from '@/pages/teacher/WeeklyPlanPage'
import TodayPage from '@/pages/student/TodayPage'
import PomodoroPage from '@/pages/student/PomodoroPage'
import RepertoirePage from '@/pages/student/RepertoirePage'
import GoalsPage from '@/pages/student/GoalsPage'
import NewGoalPage from '@/pages/teacher/NewGoalPage'
import HistoryPage from '@/pages/student/HistoryPage'

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
        <Route path="/professor/alunos/:studentId/exercicios/:exerciseId" element={<AuthGuard allowedRole="teacher"><ExerciseDetailPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/plano" element={<AuthGuard allowedRole="teacher"><WeeklyPlanPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/metas/nova" element={<AuthGuard allowedRole="teacher"><NewGoalPage /></AuthGuard>} />

        {/* Aluno */}
        <Route path="/aluno" element={<AuthGuard allowedRole="student"><Navigate to="/aluno/hoje" replace /></AuthGuard>} />
        <Route path="/aluno/hoje" element={<AuthGuard allowedRole="student"><TodayPage /></AuthGuard>} />
        <Route path="/aluno/pomodoro" element={<AuthGuard allowedRole="student"><PomodoroPage /></AuthGuard>} />
        <Route path="/aluno/repertorio" element={<AuthGuard allowedRole="student"><RepertoirePage /></AuthGuard>} />
        <Route path="/aluno/metas" element={<AuthGuard allowedRole="student"><GoalsPage /></AuthGuard>} />
        <Route path="/aluno/historico" element={<AuthGuard allowedRole="student"><HistoryPage /></AuthGuard>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}