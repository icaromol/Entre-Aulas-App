import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const NotFoundPage           = lazy(() => import('@/pages/NotFoundPage'))
const LoginPage              = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage           = lazy(() => import('@/pages/auth/RegisterPage'))
const AuthCallbackPage       = lazy(() => import('@/pages/auth/AuthCallbackPage'))

const StudentsPage           = lazy(() => import('@/pages/teacher/StudentsPage'))
const NewStudentPage         = lazy(() => import('@/pages/teacher/NewStudentPage'))
const StudentProfilePage     = lazy(() => import('@/pages/teacher/StudentProfilePage'))
const EditStudentPage        = lazy(() => import('@/pages/teacher/EditStudentPage'))
const NewPiecePage           = lazy(() => import('@/pages/teacher/NewPiecePage'))
const PieceDetailPage        = lazy(() => import('@/pages/teacher/PieceDetailPage'))
const EditPiecePage          = lazy(() => import('@/pages/teacher/EditPiecePage'))
const NewExercisePage        = lazy(() => import('@/pages/teacher/NewExercisePage'))
const ExerciseDetailPage     = lazy(() => import('@/pages/teacher/ExerciseDetailPage'))
const EditExercisePage       = lazy(() => import('@/pages/teacher/EditExercisePage'))
const NewProgramaPage        = lazy(() => import('@/pages/teacher/NewProgramaPage'))
const ProgramaDetailPage     = lazy(() => import('@/pages/teacher/ProgramaDetailPage'))
const EditProgramaPage       = lazy(() => import('@/pages/teacher/EditProgramaPage'))
const PlanejamentoPage       = lazy(() => import('@/pages/teacher/PlanejamentoPage'))
const TeacherJourneyPage     = lazy(() => import('@/pages/teacher/TeacherJourneyPage'))

const TodayPage              = lazy(() => import('@/pages/student/TodayPage'))
const PomodoroPage           = lazy(() => import('@/pages/student/PomodoroPage'))
const RepertoirePage         = lazy(() => import('@/pages/student/RepertoirePage'))
const HistoryPage            = lazy(() => import('@/pages/student/HistoryPage'))
const JourneyPage            = lazy(() => import('@/pages/student/JourneyPage'))
const StatsPage              = lazy(() => import('@/pages/student/StatsPage'))
const MyTeacherPage          = lazy(() => import('@/pages/student/MyTeacherPage'))
const StudentNewPiecePage    = lazy(() => import('@/pages/student/NewPiecePage'))
const StudentPieceDetailPage = lazy(() => import('@/pages/student/PieceDetailPage'))
const StudentEditPiecePage   = lazy(() => import('@/pages/student/EditPiecePage'))
const StudentNewExercisePage = lazy(() => import('@/pages/student/NewExercisePage'))
const StudentExerciseDetailPage = lazy(() => import('@/pages/student/ExerciseDetailPage'))
const StudentEditExercisePage   = lazy(() => import('@/pages/student/EditExercisePage'))
const StudentNewProgramaPage    = lazy(() => import('@/pages/student/NewProgramaPage'))
const StudentProgramaDetailPage = lazy(() => import('@/pages/student/ProgramaDetailPage'))
const StudentEditProgramaPage   = lazy(() => import('@/pages/student/EditProgramaPage'))

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size={28} />
    </div>
  )
}

export function Router() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Professor */}
          <Route path="/professor" element={<AuthGuard allowedRole="teacher"><Navigate to="/professor/jornada" replace /></AuthGuard>} />
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
          <Route path="/professor/jornada" element={<AuthGuard allowedRole="teacher"><TeacherJourneyPage /></AuthGuard>} />

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
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
