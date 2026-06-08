import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import NotFoundPage from '@/pages/NotFoundPage'
import { AuthGuard } from '@/components/auth/AuthGuard'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import AuthCallbackPage from '@/pages/auth/AuthCallbackPage'
import StudentsPage from '@/pages/teacher/StudentsPage'
import NewStudentPage from '@/pages/teacher/NewStudentPage'
import StudentProfilePage from '@/pages/teacher/StudentProfilePage'
import EditStudentPage from '@/pages/teacher/EditStudentPage'
import NewPiecePage from '@/pages/teacher/NewPiecePage'
import PieceDetailPage from '@/pages/teacher/PieceDetailPage'
import NewExercisePage from '@/pages/teacher/NewExercisePage'
import ExerciseDetailPage from '@/pages/teacher/ExerciseDetailPage'
import EditPiecePage from '@/pages/teacher/EditPiecePage'
import EditExercisePage from '@/pages/teacher/EditExercisePage'
import NewProgramaPage from '@/pages/teacher/NewProgramaPage'
import ProgramaDetailPage from '@/pages/teacher/ProgramaDetailPage'
import EditProgramaPage from '@/pages/teacher/EditProgramaPage'
import PlanejamentoPage from '@/pages/teacher/PlanejamentoPage'
import TodayPage from '@/pages/student/TodayPage'
import PomodoroPage from '@/pages/student/PomodoroPage'
import RepertoirePage from '@/pages/student/RepertoirePage'
import HistoryPage from '@/pages/student/HistoryPage'
import MyTeacherPage from '@/pages/student/MyTeacherPage'
import StudentNewPiecePage from '@/pages/student/NewPiecePage'
import StudentPieceDetailPage from '@/pages/student/PieceDetailPage'
import StudentEditPiecePage from '@/pages/student/EditPiecePage'
import StudentNewExercisePage from '@/pages/student/NewExercisePage'
import StudentExerciseDetailPage from '@/pages/student/ExerciseDetailPage'
import StudentEditExercisePage from '@/pages/student/EditExercisePage'
import StudentNewProgramaPage from '@/pages/student/NewProgramaPage'
import StudentProgramaDetailPage from '@/pages/student/ProgramaDetailPage'
import StudentEditProgramaPage from '@/pages/student/EditProgramaPage'
import JourneyPage from '@/pages/student/JourneyPage'
import StatsPage from '@/pages/student/StatsPage'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Professor */}
        <Route path="/professor" element={<AuthGuard allowedRole="teacher"><Navigate to="/professor/alunos" replace /></AuthGuard>} />
        <Route path="/professor/alunos" element={<AuthGuard allowedRole="teacher"><StudentsPage /></AuthGuard>} />
        <Route path="/professor/alunos/novo" element={<AuthGuard allowedRole="teacher"><NewStudentPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId" element={<AuthGuard allowedRole="teacher"><StudentProfilePage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/editar" element={<AuthGuard allowedRole="teacher"><EditStudentPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/pecas/nova" element={<AuthGuard allowedRole="teacher"><NewPiecePage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/pecas/:pieceId" element={<AuthGuard allowedRole="teacher"><PieceDetailPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/pecas/:pieceId/editar" element={<AuthGuard allowedRole="teacher"><EditPiecePage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/exercicios/novo" element={<AuthGuard allowedRole="teacher"><NewExercisePage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/exercicios/:exerciseId" element={<AuthGuard allowedRole="teacher"><ExerciseDetailPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/exercicios/:exerciseId/editar" element={<AuthGuard allowedRole="teacher"><EditExercisePage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/programas/novo" element={<AuthGuard allowedRole="teacher"><NewProgramaPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/programas/:programId" element={<AuthGuard allowedRole="teacher"><ProgramaDetailPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/programas/:programId/editar" element={<AuthGuard allowedRole="teacher"><EditProgramaPage /></AuthGuard>} />
        <Route path="/professor/alunos/:studentId/planejamento" element={<AuthGuard allowedRole="teacher"><PlanejamentoPage /></AuthGuard>} />

        {/* Aluno */}
        <Route path="/aluno" element={<AuthGuard allowedRole="student"><Navigate to="/aluno/hoje" replace /></AuthGuard>} />
        <Route path="/aluno/hoje" element={<AuthGuard allowedRole="student"><TodayPage /></AuthGuard>} />
        <Route path="/aluno/pomodoro" element={<AuthGuard allowedRole="student"><PomodoroPage /></AuthGuard>} />
        <Route path="/aluno/repertorio" element={<AuthGuard allowedRole="student"><RepertoirePage /></AuthGuard>} />
        <Route path="/aluno/repertorio/pecas/nova" element={<AuthGuard allowedRole="student"><StudentNewPiecePage /></AuthGuard>} />
        <Route path="/aluno/repertorio/pecas/:pieceId" element={<AuthGuard allowedRole="student"><StudentPieceDetailPage /></AuthGuard>} />
        <Route path="/aluno/repertorio/pecas/:pieceId/editar" element={<AuthGuard allowedRole="student"><StudentEditPiecePage /></AuthGuard>} />
        <Route path="/aluno/repertorio/exercicios/novo" element={<AuthGuard allowedRole="student"><StudentNewExercisePage /></AuthGuard>} />
        <Route path="/aluno/repertorio/exercicios/:exerciseId" element={<AuthGuard allowedRole="student"><StudentExerciseDetailPage /></AuthGuard>} />
        <Route path="/aluno/repertorio/exercicios/:exerciseId/editar" element={<AuthGuard allowedRole="student"><StudentEditExercisePage /></AuthGuard>} />
        <Route path="/aluno/repertorio/programas/novo" element={<AuthGuard allowedRole="student"><StudentNewProgramaPage /></AuthGuard>} />
        <Route path="/aluno/repertorio/programas/:programId" element={<AuthGuard allowedRole="student"><StudentProgramaDetailPage /></AuthGuard>} />
        <Route path="/aluno/repertorio/programas/:programId/editar" element={<AuthGuard allowedRole="student"><StudentEditProgramaPage /></AuthGuard>} />
        <Route path="/aluno/historico"    element={<AuthGuard allowedRole="student"><HistoryPage /></AuthGuard>} />
        <Route path="/aluno/jornada"      element={<AuthGuard allowedRole="student"><JourneyPage /></AuthGuard>} />
        <Route path="/aluno/estatisticas" element={<AuthGuard allowedRole="student"><StatsPage /></AuthGuard>} />
        <Route path="/aluno/professor"    element={<AuthGuard allowedRole="student"><MyTeacherPage /></AuthGuard>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}