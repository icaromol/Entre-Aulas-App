import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

interface Student {
  id: string
  first_name: string
  last_name: string
  instrument: string
  level: string
  status: string
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
}

interface Availability {
  day_of_week: number
  is_active: boolean
  minutes_available: number | null
}

interface Piece {
  id: string
  title: string
  composer: string | null
  status: string
  completion_pct: number
}

interface Exercise {
  id: string
  title: string
  category: string
  status: string
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const levelLabel: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
}

const statusLabel: Record<string, string> = {
  in_progress: 'Em andamento',
  completed: 'Concluída',
  paused: 'Pausada',
  future: 'Repertório futuro',
  active: 'Ativo',
}

const categoryLabel: Record<string, string> = {
  technique: 'Técnica',
  ear_training: 'Percepção',
  harmony: 'Harmonia',
  history: 'História',
  improvisation: 'Improvisação',
  other: 'Outro',
}

export default function StudentProfilePage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  const [student, setStudent] = useState<Student | null>(null)
  const [availability, setAvailability] = useState<Availability[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pieces' | 'exercises' | 'info'>('pieces')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (studentId) fetchAll()
  }, [studentId])

  async function fetchAll() {
    const [studentRes, availRes, piecesRes, exercisesRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId!).single(),
      supabase.from('student_availability').select('*').eq('student_id', studentId!).order('day_of_week'),
      supabase.from('pieces').select('id, title, composer, status, completion_pct').eq('student_id', studentId!).order('created_at', { ascending: false }),
      supabase.from('exercises').select('id, title, category, status').eq('student_id', studentId!).order('created_at', { ascending: false }),
    ])

    setStudent(studentRes.data)
    setAvailability(availRes.data ?? [])
    setPieces(piecesRes.data ?? [])
    setExercises(exercisesRes.data ?? [])
    setLoading(false)
  }

  async function handleDelete() {
    if (!student) return
    if (!confirm(`Excluir ${student.first_name} ${student.last_name}? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    await supabase.from('students').delete().eq('id', studentId!)
    navigate('/professor/alunos')
  }

  if (loading) {
    return (
      <TeacherLayout>
        <p className="text-sm text-gray-400">Carregando...</p>
      </TeacherLayout>
    )
  }

  if (!student) {
    return (
      <TeacherLayout>
        <p className="text-sm text-red-400">Aluno não encontrado.</p>
      </TeacherLayout>
    )
  }

  const activeDays = availability.filter(d => d.is_active)
  const totalMinutes = activeDays.reduce((sum, d) => sum + (d.minutes_available ?? 0), 0)

  return (
    <TeacherLayout>
      {/* Header do perfil */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/professor/alunos" className="text-gray-400 hover:text-gray-600 transition">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E3A5F]">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {student.instrument} · {levelLabel[student.level] ?? student.level}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate(`/professor/alunos/${studentId}/plano`)}
            variant="outline"
            className="text-xs"
          >
            Plano
          </Button>
          <Button
            onClick={() => navigate(`/professor/alunos/${studentId}/editar`)}
            variant="outline"
            className="text-xs"
          >
            Editar
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="outline"
            className="text-xs text-red-500 border-red-200 hover:bg-red-50"
          >
            {deleting ? '...' : 'Excluir'}
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-[#1E3A5F]">{pieces.length}</p>
          <p className="text-xs text-gray-400 mt-1">Peças</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-[#1E3A5F]">{exercises.length}</p>
          <p className="text-xs text-gray-400 mt-1">Exercícios</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-[#1E3A5F]">{totalMinutes}</p>
          <p className="text-xs text-gray-400 mt-1">min/semana</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {([
          { key: 'pieces', label: 'Peças' },
          { key: 'exercises', label: 'Exercícios' },
          { key: 'info', label: 'Informações' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === tab.key
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Peças */}
      {activeTab === 'pieces' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to={`/professor/alunos/${studentId}/pecas/nova`}>
              <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs">
                + Nova peça
              </Button>
            </Link>
          </div>

          {pieces.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-sm text-gray-400">Nenhuma peça cadastrada.</p>
            </div>
          ) : (
            pieces.map(piece => (
              <Link
                key={piece.id}
                to={`/professor/alunos/${studentId}/pecas/${piece.id}`}
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#4A90C4] transition"
              >
                <div className="relative w-10 h-10 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#F3F4F6" strokeWidth="3"/>
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke="#4A90C4" strokeWidth="3"
                      strokeDasharray={`${(piece.completion_pct / 100) * 94.2} 94.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#1E3A5F]">
                    {piece.completion_pct}%
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{piece.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {piece.composer ?? '—'} · {statusLabel[piece.status] ?? piece.status}
                  </p>
                </div>

                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Tab: Exercícios */}
      {activeTab === 'exercises' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to={`/professor/alunos/${studentId}/exercicios/novo`}>
              <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs">
                + Novo exercício
              </Button>
            </Link>
          </div>

          {exercises.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-sm text-gray-400">Nenhum exercício cadastrado.</p>
            </div>
          ) : (
            exercises.map(ex => (
              <Link
                key={ex.id}
                to={`/professor/alunos/${studentId}/exercicios/${ex.id}`}
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between hover:border-[#4A90C4] transition"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">{ex.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {categoryLabel[ex.category] ?? ex.category} · {statusLabel[ex.status] ?? ex.status}
                  </p>
                </div>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Tab: Informações */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-600">Contato</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">E-mail</span>
                <span className="text-xs text-gray-700">{student.contact_email ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Telefone</span>
                <span className="text-xs text-gray-700">{student.contact_phone ?? '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-600">Disponibilidade semanal</h3>
            <div className="space-y-2">
              {availability.map(d => (
                <div key={d.day_of_week} className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${d.is_active ? 'text-gray-700' : 'text-gray-300'}`}>
                    {DAYS[d.day_of_week]}
                  </span>
                  {d.is_active
                    ? <span className="text-xs text-[#4A90C4] font-medium">{d.minutes_available} min</span>
                    : <span className="text-xs text-gray-300">—</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {student.notes && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
              <h3 className="text-sm font-semibold text-gray-600">Observações</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{student.notes}</p>
            </div>
          )}
        </div>
      )}
    </TeacherLayout>
  )
}