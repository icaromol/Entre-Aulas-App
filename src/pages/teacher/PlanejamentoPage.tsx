import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdArrowBack, MdAutoAwesome, MdBalance, MdCheck,
  MdCheckBox, MdCheckBoxOutlineBlank, MdWarningAmber, MdAdd, MdClose,
  MdSchool, MdMusicNote, MdLibraryMusic, MdMic, MdFolder,
} from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { grantTeacherXp } from '@/lib/teacherXpHelpers'
import { fireBasic, fireStars } from '@/lib/confettiEffects'
import { sound } from '@/lib/soundEffects'
import { Spinner } from '@/components/ui/Spinner'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'
import { getMonday, formatWeekStart, formatWeekLabel } from '@/lib/weekUtils'
import {
  generatePlan,
  type GeneratedDay,
  type PlannedTask,
  type DayAvailability,
  type ResolvedProgram,
} from '@/lib/planGenerator'
import type { Programa } from '@/types/programs'

// ─── Constants ────────────────────────────────────────────────────────────────

const HORIZON_OPTIONS = [
  { value: 'week'   as const, label: 'Semana',   weeks: 1 },
  { value: 'biweek' as const, label: 'Quinzena', weeks: 2 },
  { value: 'month'  as const, label: 'Mês',      weeks: 4 },
]

const TYPE_EMOJI: Record<string, string> = {
  regular: '📚', recital: '🎭', concerto: '🎹', show: '🎤',
  gravacao: '🎙️', exame: '📋', participacao: '🎵', outro: '📁',
}

function programIcon(type: string, size = 18) {
  const icons: Record<string, React.ElementType> = {
    regular: MdSchool, recital: MdMusicNote, concerto: MdLibraryMusic,
    show: MdMic, gravacao: MdMic, exame: MdSchool,
    participacao: MdMusicNote, outro: MdFolder,
  }
  const Icon = icons[type] ?? MdLibraryMusic
  return <Icon size={size} className="text-white" />
}

const DAY_ORDER  = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayDateFromWeekStart(weekStart: string, dayOfWeek: number): string {
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function shortDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function taskCardClass(task: PlannedTask) {
  if (task.isMaintenance)             return 'bg-gray-100 hover:bg-gray-200/70'
  if (task.sourceType === 'exercise') return 'bg-rose-50 hover:bg-rose-100/80'
  return 'bg-[#D6E4F0]/60 hover:bg-[#D6E4F0]'
}

function taskTitle(task: PlannedTask) {
  return task.isMaintenance ? `Manutenção · ${task.sourceTitle}` : task.sourceTitle
}

// ─── Picker item type ─────────────────────────────────────────────────────────

interface PickerItem {
  pieceId: string | null
  exerciseId: string | null
  sourceType: 'piece' | 'exercise'
  title: string
  programId: string
  programTitle: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlanejamentoPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [step, setStep] = useState<'config' | 'preview'>('config')

  // Config state
  const [programs, setPrograms]               = useState<Programa[]>([])
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [weights, setWeights]                 = useState<Record<string, number>>({})
  const [horizon, setHorizon]                 = useState<'week' | 'biweek' | 'month'>('week')
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceBudget, setMaintenanceBudget]   = useState(20)
  const [hasCompletedPieces, setHasCompletedPieces] = useState(false)
  const [studentLevel, setStudentLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')

  // Preview state
  const [editableDays, setEditableDays]       = useState<GeneratedDay[]>([])
  const [unscheduled, setUnscheduled]         = useState<PlannedTask[]>([])
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0)
  const [pickerItems, setPickerItems]         = useState<PickerItem[]>([])
  const [pomodoroWork, setPomodoroWork]       = useState(15)

  // Edit-task sheet
  const [editingTask, setEditingTask] = useState<{ date: string; idx: number } | null>(null)

  // Add-task sheet
  const [addingToDay, setAddingToDay]               = useState<{ date: string; dow: number; weekStart: string } | null>(null)
  const [addTab, setAddTab]                         = useState<'program' | 'custom'>('program')
  const [addCustomTitle, setAddCustomTitle]         = useState('')
  const [addCustomDuration, setAddCustomDuration]   = useState(15)

  // Async state
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const weekStart = formatWeekStart(getMonday(new Date()))

  useEffect(() => { if (studentId) fetchPrograms() }, [studentId])

  // ── Data loading ────────────────────────────────────────────────────────────

  async function fetchPrograms() {
    const [{ data: progs }, { data: donePieces }, { data: student }] = await Promise.all([
      supabase.from('programas').select('*').eq('student_id', studentId!).neq('status', 'archived').order('created_at'),
      supabase.from('pieces').select('id').eq('student_id', studentId!).eq('status', 'completed'),
      supabase.from('students').select('level').eq('id', studentId!).single(),
    ])
    const list = progs ?? []
    setPrograms(list)
    setHasCompletedPieces((donePieces ?? []).length > 0)
    if (student?.level) setStudentLevel(student.level as 'beginner' | 'intermediate' | 'advanced')
    const allIds = new Set(list.map(p => p.id))
    setSelectedIds(allIds)
    distributeWeights(allIds, list)
    setLoading(false)
  }

  function distributeWeights(ids: Set<string>, list = programs) {
    if (ids.size === 0) return
    const arr = [...ids]
    const even = Math.floor(100 / arr.length)
    const rem  = 100 - even * arr.length
    const next: Record<string, number> = {}
    list.filter(p => ids.has(p.id)).forEach((p, i) => { next[p.id] = even + (i === 0 ? rem : 0) })
    setWeights(next)
  }

  function toggleProgram(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
    distributeWeights(next)
  }

  const totalWeight = [...selectedIds].reduce((s, id) => s + (weights[id] ?? 0), 0)
  const weightOk    = totalWeight === 100 && selectedIds.size > 0

  // ── Generate ────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setError('')
    setGenerating(true)
    try {
      const { data: availData } = await supabase
        .from('student_availability')
        .select('day_of_week, minutes_available')
        .eq('student_id', studentId!)
        .eq('is_active', true)

      const availability: DayAvailability[] = (availData ?? []).map(a => ({
        dayOfWeek: a.day_of_week, minutesAvailable: a.minutes_available,
      }))

      if (availability.length === 0) {
        setError('O aluno não tem dias de disponibilidade configurados.')
        setGenerating(false)
        return
      }

      const selected      = programs.filter(p => selectedIds.has(p.id))
      const nonRegularIds = selected.filter(p => p.type !== 'regular').map(p => p.id)

      // Busca todas as peças e exercícios do aluno
      const [{ data: allPieces }, { data: allExercises }] = await Promise.all([
        supabase.from('pieces')
          .select('id, title, difficulty, completion_pct, status')
          .eq('student_id', studentId!)
          .in('status', ['in_progress', 'future', 'completed']),
        supabase.from('exercises')
          .select('id, title, category, difficulty')
          .eq('student_id', studentId!)
          .eq('status', 'active'),
      ])

      const piecesMap:    Record<string, NonNullable<typeof allPieces>[0]>    = {}
      const exercisesMap: Record<string, NonNullable<typeof allExercises>[0]> = {}
      ;(allPieces    ?? []).forEach(p => { piecesMap[p.id]    = p })
      ;(allExercises ?? []).forEach(e => { exercisesMap[e.id] = e })

      // Links de programas não-regulares
      let progPieces:    Array<{ program_id: string; piece_id: string;    priority_override: number | null }> = []
      let progExercises: Array<{ program_id: string; exercise_id: string; priority_override: number | null }> = []
      if (nonRegularIds.length > 0) {
        const [{ data: pp }, { data: pe }] = await Promise.all([
          supabase.from('program_pieces')   .select('program_id, piece_id, priority_override')   .in('program_id', nonRegularIds),
          supabase.from('program_exercises').select('program_id, exercise_id, priority_override').in('program_id', nonRegularIds),
        ])
        progPieces    = pp ?? []
        progExercises = pe ?? []
      }

      // Monta ResolvedProgram[] com peças e exercícios diretos (sem checklist)
      const resolvedPrograms: ResolvedProgram[] = selected.map(prog => {
        const pieces    = []
        const exercises = []

        if (prog.type === 'regular') {
          // Programa regular: inclui tudo do aluno
          for (const p of allPieces ?? []) {
            pieces.push({
              pieceId: p.id, pieceTitle: p.title,
              difficulty: p.difficulty, completionPct: p.completion_pct,
              status: p.status, priorityOverride: null,
            })
          }
          for (const e of allExercises ?? []) {
            exercises.push({
              exerciseId: e.id, exerciseTitle: e.title,
              difficulty: e.difficulty, category: e.category,
              priorityOverride: null,
            })
          }
        } else {
          // Outros tipos: só os itens linkados ao programa
          for (const pp of progPieces.filter(x => x.program_id === prog.id)) {
            const p = piecesMap[pp.piece_id]
            if (!p) continue
            pieces.push({
              pieceId: p.id, pieceTitle: p.title,
              difficulty: p.difficulty, completionPct: p.completion_pct,
              status: p.status, priorityOverride: pp.priority_override,
            })
          }
          for (const pe of progExercises.filter(x => x.program_id === prog.id)) {
            const e = exercisesMap[pe.exercise_id]
            if (!e) continue
            exercises.push({
              exerciseId: e.id, exerciseTitle: e.title,
              difficulty: e.difficulty, category: e.category,
              priorityOverride: pe.priority_override,
            })
          }
        }

        return { id: prog.id, title: prog.title, type: prog.type, deadline: prog.deadline, weight: weights[prog.id] ?? 0, pieces, exercises }
      })

      // Peças concluídas para manutenção
      const completedPieces = (allPieces ?? [])
        .filter(p => p.status === 'completed')
        .map(p => ({ pieceId: p.id, pieceTitle: p.title, difficulty: p.difficulty }))

      const plan = generatePlan({
        studentLevel,
        weekStart, horizon, availability,
        programs: resolvedPrograms,
        maintenance: {
          enabled: maintenanceEnabled,
          budgetPercent: maintenanceBudget,
          completedPieces,
        },
      })

      // Picker para o sheet "Adicionar tarefa"
      const seen = new Set<string>()
      const picker: PickerItem[] = resolvedPrograms.flatMap(prog => {
        const items: PickerItem[] = []
        for (const p of prog.pieces) {
          if (p.status === 'completed') continue
          const key = `piece:${p.pieceId}`
          if (!seen.has(key)) { seen.add(key); items.push({ pieceId: p.pieceId, exerciseId: null, sourceType: 'piece', title: p.pieceTitle, programId: prog.id, programTitle: prog.title }) }
        }
        for (const e of prog.exercises) {
          const key = `ex:${e.exerciseId}`
          if (!seen.has(key)) { seen.add(key); items.push({ pieceId: null, exerciseId: e.exerciseId, sourceType: 'exercise', title: e.exerciseTitle, programId: prog.id, programTitle: prog.title }) }
        }
        return items
      })

      setPomodoroWork(plan.pomodoroWork)
      setPickerItems(picker)
      setEditableDays(plan.days.map(d => ({ ...d, tasks: [...d.tasks] })))
      setUnscheduled(plan.unscheduled)
      setSelectedWeekIdx(0)
      setStep('preview')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar planejamento.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Task mutation helpers ───────────────────────────────────────────────────

  function updateTaskDuration(date: string, idx: number, duration: number) {
    setEditableDays(prev => prev.map(d => {
      if (d.date !== date) return d
      const tasks = d.tasks.map((t, i) => i === idx ? { ...t, durationMinutes: Math.max(5, duration) } : t)
      return { ...d, tasks, minutesUsed: tasks.reduce((s, t) => s + t.durationMinutes, 0) }
    }))
  }

  function deleteTask(date: string, idx: number) {
    setEditableDays(prev => prev.map(d => {
      if (d.date !== date) return d
      const tasks = d.tasks.filter((_, i) => i !== idx)
      return { ...d, tasks, minutesUsed: tasks.reduce((s, t) => s + t.durationMinutes, 0) }
    }))
    setEditingTask(null)
  }

  function addTaskToDay(date: string, dow: number, ws: string, task: PlannedTask) {
    setEditableDays(prev => {
      const exists = prev.find(d => d.date === date)
      if (exists) {
        return prev.map(d => {
          if (d.date !== date) return d
          const tasks = [...d.tasks, task]
          return { ...d, tasks, minutesUsed: tasks.reduce((s, t) => s + t.durationMinutes, 0) }
        })
      }
      return [...prev, {
        weekStart: ws, dayOfWeek: dow, date,
        minutesAvailable: 0, slots: 0, minutesUsed: task.durationMinutes, tasks: [task],
      }]
    })
    setAddingToDay(null)
    setAddCustomTitle('')
    setAddCustomDuration(pomodoroWork)
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const { data: teacher } = await supabase
        .from('teachers').select('id').eq('profile_id', profile!.id).single()
      if (!teacher) throw new Error('Professor não encontrado.')

      const weekStarts = [...new Set(editableDays.map(d => d.weekStart))]
      for (const ws of weekStarts) {
        let planId: string
        const { data: existing } = await supabase
          .from('weekly_plans').select('id').eq('student_id', studentId!).eq('week_start', ws).single()
        if (existing) {
          planId = existing.id
          await supabase.from('plan_items').delete().eq('plan_id', planId)
        } else {
          const { data: created, error: err } = await supabase
            .from('weekly_plans').insert({ student_id: studentId!, week_start: ws, teacher_id: teacher.id }).select('id').single()
          if (err || !created) throw err ?? new Error('Erro ao criar plano semanal.')
          planId = created.id
        }

        const rows: object[] = []
        for (const day of editableDays.filter(d => d.weekStart === ws)) {
          day.tasks.forEach((task, pos) => {
            rows.push({
              plan_id:          planId,
              piece_id:         task.pieceId,
              exercise_id:      task.exerciseId,
              program_id:       task.programId,
              day_of_week:      day.dayOfWeek,
              duration_minutes: task.durationMinutes,
              is_done:          false,
              position:         pos,
              is_maintenance:   task.isMaintenance,
            })
          })
        }
        if (rows.length > 0) {
          const { error: err } = await supabase.from('plan_items').insert(rows)
          if (err) throw err
        }
      }
      // XP por plano criado + confetti (um grant por semana gerada)
      const allAchievements: string[] = []
      for (const ws of weekStarts) {
        const { newAchievements } = await grantTeacherXp(teacher.id, 'new_plan', ws)
        allAchievements.push(...newAchievements)
      }
      sound.xpEarn()
      if (allAchievements.length > 0) fireStars()
      else fireBasic()
      toast.success('Planejamento salvo!')
      navigate(`/professor/alunos/${studentId}?tab=plans`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  // ── Drag-to-scroll ──────────────────────────────────────────────────────────

  const scrollRef    = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const dragStartX   = useRef(0)
  const dragScrollL  = useRef(0)
  const [grabbing, setGrabbing] = useState(false)

  function onBoardMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!scrollRef.current) return
    isDragging.current  = true; dragStartX.current  = e.clientX
    dragScrollL.current = scrollRef.current.scrollLeft; setGrabbing(true)
  }
  function onBoardMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDragging.current || !scrollRef.current) return
    e.preventDefault()
    scrollRef.current.scrollLeft = dragScrollL.current - (e.clientX - dragStartX.current) * 1.4
  }
  function onBoardMouseUp()    { isDragging.current = false; setGrabbing(false) }
  function onBoardMouseLeave() { isDragging.current = false; setGrabbing(false) }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const weekStarts     = [...new Set(editableDays.map(d => d.weekStart))].sort()
  const currentWS      = weekStarts[selectedWeekIdx] ?? weekStart
  const totalScheduled = editableDays.reduce((s, d) => s + d.tasks.length, 0)
  const totalMinutes   = editableDays.reduce((s, d) => s + d.minutesUsed, 0)

  const columns = DAY_ORDER.map((dow, i) => {
    const date = dayDateFromWeekStart(currentWS, dow)
    const day  = editableDays.find(d => d.date === date) ?? null
    return { dow, date, label: DAY_LABELS[i], day }
  })

  const levelLabel: Record<string, string> = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado' }

  if (!isValidUUID(studentId)) return <Navigate to="/" replace />
  if (loading) return <TeacherLayout><div className="flex justify-center py-12"><Spinner /></div></TeacherLayout>

  // ── Config step ─────────────────────────────────────────────────────────────

  if (step === 'config') {
    return (
      <TeacherLayout>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(`/professor/alunos/${studentId}?tab=plans`)} className="text-gray-400 hover:text-gray-600 transition">
            <MdArrowBack size={20} />
          </button>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Planejamento de Estudos</h1>
        </div>

        {programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#D6E4F0] flex items-center justify-center mb-4">
              <MdAutoAwesome size={24} className="text-[#1E3A5F]" />
            </div>
            <p className="text-base font-bold text-[#1E3A5F] mb-2">Nenhum programa ativo</p>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-5">
              Crie ao menos um programa para o aluno antes de gerar o planejamento.
            </p>
            <Button onClick={() => navigate(`/professor/alunos/${studentId}/programas/novo`)}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl px-6">
              Criar programa
            </Button>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Nível do aluno detectado */}
            <div className="bg-[#D6E4F0]/50 border border-[#4A90C4]/20 rounded-2xl px-5 py-3 flex items-center gap-3">
              <div>
                <p className="text-xs font-semibold text-[#1E3A5F]">Ciclo pomodoro · {levelLabel[studentLevel]}</p>
                <p className="text-xs text-[#1E3A5F]/60 mt-0.5">
                  {studentLevel === 'beginner' ? '10 min trabalho · 5 min pausa' :
                   studentLevel === 'intermediate' ? '15 min trabalho · 5 min pausa' :
                   '25 min trabalho · 5 min pausa'}
                </p>
              </div>
            </div>

            {/* Programas */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-600">Programas</h2>
                <button onClick={() => distributeWeights(selectedIds)}
                  className="flex items-center gap-1 text-xs text-[#4A90C4] hover:text-[#1E3A5F] transition">
                  <MdBalance size={13} /> Auto-balancear
                </button>
              </div>
              <div className="space-y-2">
                {programs.map(prog => {
                  const sel = selectedIds.has(prog.id)
                  return (
                    <div key={prog.id} className={`rounded-xl border transition ${sel ? 'border-[#4A90C4] bg-[#D6E4F0]/30' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-center gap-3 p-3">
                        <button onClick={() => toggleProgram(prog.id)} className="text-[#4A90C4] shrink-0">
                          {sel ? <MdCheckBox size={20} /> : <MdCheckBoxOutlineBlank size={20} className="text-gray-300" />}
                        </button>
                        <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center shrink-0">
                          {programIcon(prog.type, 16)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{prog.title}</p>
                          {prog.deadline && (
                            <p className="text-xs text-gray-400">
                              {new Date(prog.deadline + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </div>
                        {sel && (
                          <span className="text-sm font-bold text-[#1E3A5F] shrink-0 w-10 text-right">
                            {weights[prog.id] ?? 0}%
                          </span>
                        )}
                      </div>
                      {sel && (
                        <div className="px-3 pb-3 flex items-center gap-2">
                          <input
                            type="range" min={0} max={100} step={1}
                            value={weights[prog.id] ?? 0}
                            onChange={e => setWeights(w => ({ ...w, [prog.id]: Number(e.target.value) }))}
                            className="flex-1 accent-[#4A90C4] h-2"
                          />
                          <input
                            type="number" min={0} max={100}
                            value={weights[prog.id] ?? 0}
                            onChange={e => setWeights(w => ({ ...w, [prog.id]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                            className="w-12 text-center text-xs border border-gray-200 rounded-lg px-1 py-1.5 outline-none focus:border-[#4A90C4]"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {selectedIds.size > 0 && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${weightOk ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                  {weightOk ? <MdCheck size={14} /> : <MdWarningAmber size={14} />}
                  {weightOk ? 'Os pesos somam 100% — tudo certo!' : `Os pesos somam ${totalWeight}%. Ajuste para chegar a 100%.`}
                </div>
              )}
            </div>

            {/* Horizonte */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">Horizonte de planejamento</h2>
              <div className="grid grid-cols-3 gap-2">
                {HORIZON_OPTIONS.map(h => (
                  <button key={h.value} onClick={() => setHorizon(h.value)}
                    className={`py-2 rounded-xl border text-sm font-medium transition ${horizon === h.value ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'}`}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Manutenção */}
            {hasCompletedPieces && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-600">Opções</h2>
                <div className="space-y-2">
                  <button onClick={() => setMaintenanceEnabled(v => !v)} className="w-full flex items-center gap-3 text-left">
                    {maintenanceEnabled ? <MdCheckBox size={20} className="text-[#4A90C4] shrink-0" /> : <MdCheckBoxOutlineBlank size={20} className="text-gray-300 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-700">Manutenção de repertório concluído</p>
                      <p className="text-xs text-gray-400">Peças concluídas revisitadas em ciclo rotativo</p>
                    </div>
                  </button>
                  {maintenanceEnabled && (
                    <div className="ml-8 flex items-center gap-3">
                      <input type="range" min={10} max={40} step={5} value={maintenanceBudget}
                        onChange={e => setMaintenanceBudget(Number(e.target.value))} className="flex-1 accent-[#4A90C4]" />
                      <span className="text-sm font-semibold text-[#1E3A5F] w-8">{maintenanceBudget}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button onClick={handleGenerate} disabled={!weightOk || generating}
              className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10 flex items-center gap-2">
              <MdAutoAwesome size={16} />
              {generating ? 'Gerando...' : `Gerar preview — ${HORIZON_OPTIONS.find(h => h.value === horizon)?.label}`}
            </Button>
          </div>
        )}
      </TeacherLayout>
    )
  }

  // ── Preview step ─────────────────────────────────────────────────────────────

  const editTask = editingTask
    ? editableDays.find(d => d.date === editingTask.date)?.tasks[editingTask.idx] ?? null
    : null

  return (
    <TeacherLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setStep('config')} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </button>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Preview do Planejamento</h1>
      </div>

      {/* Stats + pomodoro info */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Tarefas', value: totalScheduled },
          { label: 'Semanas', value: weekStarts.length },
          { label: 'Minutos', value: totalMinutes },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-[#1E3A5F]">{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-[#D6E4F0]/50 rounded-xl px-3 py-2 mb-4">
        <span className="text-xs text-[#1E3A5F]/70">Slots de <span className="font-bold text-[#1E3A5F]">{pomodoroWork} min</span> por tarefa · {levelLabel[studentLevel]}</span>
      </div>

      {/* Week tabs */}
      {weekStarts.length > 1 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {weekStarts.map((ws, i) => (
            <button key={ws} onClick={() => setSelectedWeekIdx(i)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${i === selectedWeekIdx ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#4A90C4]'}`}>
              {formatWeekLabel(ws)}
            </button>
          ))}
        </div>
      )}

      {/* Board */}
      <div
        ref={scrollRef}
        className={`board-scroll md:overflow-x-scroll mt-2 mb-4 pt-1 pb-5 rounded-b-xl ${grabbing ? 'cursor-grabbing select-none' : 'md:cursor-grab'}`}
        onMouseDown={onBoardMouseDown}
        onMouseMove={onBoardMouseMove}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseLeave}
      >
        <div className="flex flex-col md:flex-row md:min-w-max gap-3">
          {columns.map(col => {
            const tasks       = col.day?.tasks ?? []
            const minutesUsed = col.day?.minutesUsed ?? 0
            const isAvailable = col.day !== null || tasks.length > 0

            return (
              <div key={col.date}
                className={`w-full md:flex-none md:w-80 rounded-2xl border overflow-hidden flex flex-col ${isAvailable ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100'}`}>

                <div className={`px-4 py-3 border-b flex items-center justify-between bg-gray-50 border-gray-100`}>
                  <div>
                    <p className={`text-sm font-bold ${isAvailable ? 'text-gray-700' : 'text-gray-300'}`}>{col.label}</p>
                    <p className="text-xs text-gray-400">{shortDate(col.date)}</p>
                  </div>
                  {minutesUsed > 0 && (
                    <span className="text-xs font-semibold text-[#4A90C4]">{minutesUsed} min</span>
                  )}
                </div>

                <div className="flex-1 p-3 space-y-2">
                  {tasks.length === 0 && !isAvailable && (
                    <p className="text-xs text-gray-300 text-center py-4">Folga</p>
                  )}
                  {tasks.map((task, i) => (
                    <button key={i} onClick={() => setEditingTask({ date: col.date, idx: i })}
                      className={`w-full text-left rounded-xl p-3 transition group ${taskCardClass(task)}`}>
                      <div className="flex items-start gap-2">
                        {task.isMaintenance && <span className="text-sm shrink-0 mt-0.5">🔄</span>}
                        <p className="text-sm font-medium text-gray-700 flex-1 leading-snug line-clamp-2">
                          {taskTitle(task)}
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); deleteTask(col.date, i) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 shrink-0 transition mt-0.5">
                          <MdClose size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate">{task.programTitle}</p>
                      <p className="text-xs font-semibold text-[#4A90C4] mt-1">{task.durationMinutes} min</p>
                    </button>
                  ))}
                </div>

                <div className="px-3 pb-3">
                  <button
                    onClick={() => { setAddingToDay({ date: col.date, dow: col.dow, weekStart: currentWS }); setAddTab('program') }}
                    className="w-full py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 hover:border-[#4A90C4] hover:text-[#4A90C4] transition flex items-center justify-center gap-1">
                    <MdAdd size={14} /> Adicionar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Overflow warning */}
      {unscheduled.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-4">
          <MdWarningAmber size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{unscheduled.length} {unscheduled.length === 1 ? 'item não coube' : 'itens não couberam'}</span> no período.
            Aumente a disponibilidade do aluno ou use o botão + para distribuí-los manualmente.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex gap-3 pb-8">
        <Button onClick={() => setStep('config')} variant="outline" className="flex-1 rounded-xl border-gray-200 text-gray-600">
          Voltar
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl">
          {saving ? 'Salvando...' : 'Confirmar e Salvar'}
        </Button>
      </div>

      {/* Edit-task sheet */}
      {editingTask && editTask && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={() => setEditingTask(null)}>
          <div className="bg-white rounded-t-2xl px-6 pt-6 pb-8 w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-base font-bold text-[#1E3A5F] line-clamp-2">{taskTitle(editTask)}</p>
                <p className="text-sm text-gray-400 mt-1 truncate">{editTask.programTitle}</p>
              </div>
              <button onClick={() => setEditingTask(null)} className="text-gray-400 shrink-0"><MdClose size={22} /></button>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-8 mb-3">Duração</p>
            <div className="flex items-center gap-4 mb-10">
              <input type="number" min={5} max={180} value={editTask.durationMinutes}
                onChange={e => updateTaskDuration(editingTask.date, editingTask.idx, Number(e.target.value))}
                className="w-20 text-center border border-gray-200 rounded-xl px-2 py-2.5 text-base font-semibold text-[#1E3A5F] outline-none focus:border-[#4A90C4]"
              />
              <span className="text-sm text-gray-400">min</span>
              <input type="range" min={5} max={180} step={5} value={editTask.durationMinutes}
                onChange={e => updateTaskDuration(editingTask.date, editingTask.idx, Number(e.target.value))}
                className="flex-1 accent-[#4A90C4] h-2"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => deleteTask(editingTask.date, editingTask.idx)}
                className="flex-1 py-3 rounded-xl border border-red-100 text-red-400 text-sm font-semibold hover:bg-red-50 transition">
                Excluir tarefa
              </button>
              <button onClick={() => setEditingTask(null)}
                className="flex-1 py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add-task sheet */}
      {addingToDay && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={() => setAddingToDay(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg mx-auto max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <p className="text-sm font-bold text-[#1E3A5F]">
                Adicionar tarefa — {DAY_LABELS[DAY_ORDER.indexOf(addingToDay.dow)]} {shortDate(addingToDay.date)}
              </p>
              <button onClick={() => setAddingToDay(null)} className="text-gray-400"><MdClose size={20} /></button>
            </div>
            <div className="flex gap-1 px-5 pb-3 shrink-0">
              {(['program', 'custom'] as const).map(tab => (
                <button key={tab} onClick={() => setAddTab(tab)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition ${addTab === tab ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {tab === 'program' ? 'Do programa' : 'Personalizado'}
                </button>
              ))}
            </div>
            {addTab === 'program' ? (
              <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-2">
                {pickerItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhum item disponível.</p>
                ) : pickerItems.map((item, idx) => (
                  <button key={idx}
                    onClick={() => addTaskToDay(addingToDay.date, addingToDay.dow, addingToDay.weekStart, {
                      pieceId: item.pieceId,
                      exerciseId: item.exerciseId,
                      sourceType: item.sourceType,
                      sourceTitle: item.title,
                      programId: item.programId,
                      programTitle: item.programTitle,
                      durationMinutes: pomodoroWork,
                      isMaintenance: false,
                      score: 0,
                    })}
                    className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-[#4A90C4] transition">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {TYPE_EMOJI[item.programTitle] ?? ''} {item.programTitle}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-6 pb-8 shrink-0 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nome da tarefa</label>
                  <input
                    value={addCustomTitle}
                    onChange={e => setAddCustomTitle(e.target.value)}
                    placeholder="Ex: Praticar escala cromática"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Duração: <span className="text-[#1E3A5F]">{addCustomDuration} min</span>
                  </label>
                  <input type="range" min={5} max={120} step={5} value={addCustomDuration}
                    onChange={e => setAddCustomDuration(Number(e.target.value))} className="w-full accent-[#4A90C4] h-2" />
                </div>
                <Button
                  disabled={!addCustomTitle.trim()}
                  onClick={() => addTaskToDay(addingToDay.date, addingToDay.dow, addingToDay.weekStart, {
                    pieceId: null, exerciseId: null,
                    sourceType: 'piece',
                    sourceTitle: addCustomTitle.trim(),
                    programId: null, programTitle: 'Personalizado',
                    durationMinutes: addCustomDuration,
                    isMaintenance: false, score: 0,
                  })}
                  className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10">
                  Adicionar tarefa
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </TeacherLayout>
  )
}
