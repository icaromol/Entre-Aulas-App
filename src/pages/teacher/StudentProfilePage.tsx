import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdMusicNote, MdSchool, MdOutlineFlag, MdCalendarMonth, MdAccessTime, MdChevronRight, MdAdd, MdEdit } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'

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

interface Goal {
  id: string
  title: string
  type: string
  target_value: string | null
  due_date: string | null
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const levelLabel: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
}

const pieceStatusLabel: Record<string, string> = {
  in_progress: 'Em andamento',
  completed: 'Concluída',
  paused: 'Pausada',
  future: 'Repertório futuro',
}

const exerciseCategoryLabel: Record<string, string> = {
  technique: 'Técnica',
  ear_training: 'Percepção',
  harmony: 'Harmonia',
  history: 'História',
  improvisation: 'Improvisação',
  other: 'Outro',
}

const exerciseStatusLabel: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  completed: 'Concluído',
}

const typeLabel: Record<string, string> = {
  free: 'Livre',
  measurable: 'Mensurável',
  checklist_item: 'Checklist',
  exercise: 'Exercício',
}

const typeBadge: Record<string, string> = {
  free: 'bg-blue-50 text-blue-600',
  measurable: 'bg-amber-50 text-amber-700',
  checklist_item: 'bg-purple-50 text-purple-600',
  exercise: 'bg-green-50 text-green-700',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

type TabKey = 'pieces' | 'exercises' | 'goals' | 'plan'

export default function StudentProfilePage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const menuRef = useRef<HTMLDivElement>(null)

  const [student, setStudent] = useState<Student | null>(null)
  const [availability, setAvailability] = useState<Availability[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const initialTab = (searchParams.get('tab') as TabKey) ?? 'pieces'
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [showMenu, setShowMenu] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [completingGoalId, setCompletingGoalId] = useState<string | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (studentId) fetchAll()
  }, [studentId])

  async function fetchAll() {
    const [studentRes, availRes, piecesRes, exercisesRes, goalsRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId!).single(),
      supabase.from('student_availability').select('*').eq('student_id', studentId!).order('day_of_week'),
      supabase.from('pieces').select('id, title, composer, status, completion_pct').eq('student_id', studentId!).order('created_at', { ascending: false }),
      supabase.from('exercises').select('id, title, category, status').eq('student_id', studentId!).order('created_at', { ascending: false }),
      supabase.from('goals').select('id, title, type, target_value, due_date').eq('student_id', studentId!).eq('status', 'active').order('created_at', { ascending: false }),
    ])

    setStudent(studentRes.data)
    setAvailability(availRes.data ?? [])
    setPieces(piecesRes.data ?? [])
    setExercises(exercisesRes.data ?? [])
    setGoals(goalsRes.data ?? [])
    setLoading(false)
  }

  async function handleDelete() {
    if (!student) return
    if (!confirm(`Excluir ${student.first_name} ${student.last_name}? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    await supabase.from('students').delete().eq('id', studentId!)
    navigate('/professor/alunos')
  }

  async function completeGoal(id: string) {
    setCompletingGoalId(id)
    await supabase.from('goals').update({ status: 'completed' }).eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
    setCompletingGoalId(null)
    toast.success('Tarefa concluída!')
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
      {/* Modal de Informações */}
      {showInfo && (
        <div
          className="fixed inset-0 bg-black/40 z-20 flex items-end justify-center"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="bg-white rounded-t-2xl p-5 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1E3A5F]">Informações</h2>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contato</h3>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">E-mail</span>
                  <span className="text-xs text-gray-700">{student.contact_email ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">Telefone</span>
                  <span className="text-xs text-gray-700">{student.contact_phone ?? '—'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Disponibilidade semanal</h3>
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
              {student.notes && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Observações</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{student.notes}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="mt-5 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/professor/alunos" className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E3A5F]">{student.first_name} {student.last_name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {student.instrument} · {levelLabel[student.level] ?? student.level}
          </p>
        </div>

        {/* ⋯ menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(v => !v)}
            className="w-8 h-8 flex flex-col items-center justify-center gap-[3px] rounded-lg hover:bg-gray-100 transition"
            aria-label="Mais opções"
          >
            <span className="w-1 h-1 rounded-full bg-gray-500"/>
            <span className="w-1 h-1 rounded-full bg-gray-500"/>
            <span className="w-1 h-1 rounded-full bg-gray-500"/>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-44 z-10">
              <button
                onClick={() => { setShowMenu(false); setShowInfo(true) }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Informações
              </button>
              <button
                onClick={() => { setShowMenu(false); navigate(`/professor/alunos/${studentId}/editar`) }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Editar
              </button>
              <div className="border-t border-gray-100 my-1"/>
              <button
                onClick={() => { setShowMenu(false); handleDelete() }}
                disabled={deleting}
                className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition disabled:opacity-50"
              >
                {deleting ? '...' : 'Excluir aluno'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdMusicNote size={16} className="mx-auto mb-1 text-[#4A90C4]" />
          <p className="text-2xl font-bold text-[#1E3A5F]">{pieces.length}</p>
          <p className="text-xs text-gray-400 mt-1">Peças</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdSchool size={16} className="mx-auto mb-1 text-[#4A90C4]" />
          <p className="text-2xl font-bold text-[#1E3A5F]">{exercises.length}</p>
          <p className="text-xs text-gray-400 mt-1">Exercícios</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdAccessTime size={16} className="mx-auto mb-1 text-[#4A90C4]" />
          <p className="text-2xl font-bold text-[#1E3A5F]">{totalMinutes}</p>
          <p className="text-xs text-gray-400 mt-1">min/semana</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {([
          { key: 'pieces',    label: 'Peças',      Icon: MdMusicNote },
          { key: 'exercises', label: 'Exercícios',  Icon: MdSchool },
          { key: 'goals',     label: 'Tarefas',     Icon: MdOutlineFlag },
          { key: 'plan',      label: 'Plano',       Icon: MdCalendarMonth },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === tab.key
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <tab.Icon size={13} />
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
                <MdAdd size={15} className="inline -mt-0.5 mr-0.5" />Nova peça
              </Button>
            </Link>
          </div>
          {pieces.length === 0 ? (
            <EmptyState title="Nenhuma peça ainda" description="Adicione a primeira peça do repertório." />
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
                    {piece.composer ?? '—'} · {pieceStatusLabel[piece.status] ?? piece.status}
                  </p>
                </div>
                <MdChevronRight size={16} className="text-gray-400 shrink-0" />
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
                <MdAdd size={15} className="inline -mt-0.5 mr-0.5" />Novo exercício
              </Button>
            </Link>
          </div>
          {exercises.length === 0 ? (
            <EmptyState title="Nenhum exercício ainda" description="Adicione exercícios técnicos ou teóricos." />
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
                    {exerciseCategoryLabel[ex.category] ?? ex.category} · {exerciseStatusLabel[ex.status] ?? ex.status}
                  </p>
                </div>
                <MdChevronRight size={16} className="text-gray-400 shrink-0" />
              </Link>
            ))
          )}
        </div>
      )}

      {/* Tab: Metas */}
      {activeTab === 'goals' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to={`/professor/alunos/${studentId}/metas/nova`}>
              <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs">
                <MdAdd size={15} className="inline -mt-0.5 mr-0.5" />Nova meta
              </Button>
            </Link>
          </div>
          {goals.length === 0 ? (
            <EmptyState title="Nenhuma meta ativa" description="Defina metas de repertório, técnica ou progresso." />
          ) : (
            goals.map(goal => (
              <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-800 flex-1">{goal.title}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${typeBadge[goal.type] ?? 'bg-gray-100 text-gray-500'}`}>
                    {typeLabel[goal.type] ?? goal.type}
                  </span>
                </div>
                {(goal.target_value || goal.due_date) && (
                  <div className="flex gap-3 mb-3">
                    {goal.target_value && (
                      <span className="text-xs text-gray-400">Alvo: {goal.target_value}</span>
                    )}
                    {goal.due_date && (
                      <span className="text-xs text-gray-400">Prazo: {formatDate(goal.due_date)}</span>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/professor/alunos/${studentId}/metas/${goal.id}/editar`)}
                    className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-[#4A90C4] transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => completeGoal(goal.id)}
                    disabled={completingGoalId === goal.id}
                    className="flex-1 py-1.5 rounded-lg bg-[#D6E4F0] text-xs font-medium text-[#1E3A5F] hover:bg-[#4A90C4] hover:text-white transition disabled:opacity-50"
                  >
                    {completingGoalId === goal.id ? '...' : 'Concluir'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Plano */}
      {activeTab === 'plan' && (
        <div className="space-y-3">
          <button
            onClick={() => navigate(`/professor/alunos/${studentId}/plano`)}
            className="w-full bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between hover:border-[#4A90C4] transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#D6E4F0] flex items-center justify-center shrink-0">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#1E3A5F" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">Abrir plano semanal</p>
                <p className="text-xs text-gray-400 mt-0.5">Ver e editar a semana atual</p>
              </div>
            </div>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>

          <button
            onClick={() => navigate(`/professor/alunos/${studentId}/plano`)}
            className="w-full bg-[#1E3A5F] rounded-2xl px-5 py-4 flex items-center justify-between hover:bg-[#1E3A5F]/90 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Criar novo plano</p>
                <p className="text-xs text-white/60 mt-0.5">Montar o plano da semana</p>
              </div>
            </div>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      )}
    </TeacherLayout>
  )
}
