import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdArrowBack, MdAutoAwesome, MdBalance, MdCheck,
  MdCheckBox, MdCheckBoxOutlineBlank, MdWarningAmber, MdAdd, MdClose,
} from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'
import { getMonday, formatWeekStart, formatWeekLabel } from '@/lib/weekUtils'
import {
  generatePlan,
  type GeneratedDay,
  type PlannedTask,
  type DayAvailability,
  type ResolvedProgram,
  type ResolvedProgramItem,
  type MaintenancePiece,
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

// Mon=1 … Sat=6, Sun=0 — display order Mon→Sun
const DAY_ORDER   = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dayDateFromWeekStart(weekStart: string, dayOfWeek: number): string {
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function shortDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function taskIcon(task: PlannedTask) {
  if (task.isMaintenance)          return '🔄'
  if (task.sourceType === 'exercise') return '🎯'
  return '🎵'
}

function taskTitle(task: PlannedTask) {
  return task.isMaintenance
    ? `Manutenção · ${task.sourceTitle}`
    : task.checklistItemTitle ?? task.sourceTitle
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PickerItem {
  item: ResolvedProgramItem
  programId: string
  programTitle: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlanejamentoPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<'config' | 'preview'>('config')

  // ── Config state ──────────────────────────────────────────────────────────
  const [programs, setPrograms]               = useState<Programa[]>([])
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [weights, setWeights]                 = useState<Record<string, number>>({})
  const [horizon, setHorizon]                 = useState<'week' | 'biweek' | 'month'>('week')
  const [includeRevision, setIncludeRevision] = useState(false)
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceBudget, setMaintenanceBudget]   = useState(20)
  const [hasCompletedPieces, setHasCompletedPieces] = useState(false)

  // ── Preview editable state ────────────────────────────────────────────────
  const [editableDays, setEditableDays]   = useState<GeneratedDay[]>([])
  const [unscheduled, setUnscheduled]     = useState<PlannedTask[]>([])
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0)
  const [pickerItems, setPickerItems]     = useState<PickerItem[]>([])

  // Edit-task sheet
  const [editingTask, setEditingTask] = useState<{ date: string; idx: number } | null>(null)

  // Add-task sheet
  const [addingToDay, setAddingToDay] = useState<{ date: string; dow: number; weekStart: string } | null>(null)
  const [addTab, setAddTab]           = useState<'program' | 'custom'>('program')
  const [addCustomTitle, setAddCustomTitle]     = useState('')
  const [addCustomDuration, setAddCustomDuration] = useState(15)

  // ── Async state ───────────────────────────────────────────────────────────
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const weekStart = formatWeekStart(getMonday(new Date()))

  useEffect(() => { if (studentId) fetchPrograms() }, [studentId])

  // ── Data loading ──────────────────────────────────────────────────────────

  async function fetchPrograms() {
    const [{ data: progs }, { data: donePieces }] = await Promise.all([
      supabase.from('programas').select('*').eq('student_id', studentId!).neq('status', 'archived').order('created_at'),
      supabase.from('pieces').select('id').eq('student_id', studentId!).eq('completion_pct', 100),
    ])
    const list = progs ?? []
    setPrograms(list)
    setHasCompletedPieces((donePieces ?? []).length > 0)
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

  // ── Generate ──────────────────────────────────────────────────────────────

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
        return
      }

      const selected = programs.filter(p => selectedIds.has(p.id))
      const nonRegularIds = selected.filter(p => p.type !== 'regular').map(p => p.id)

      const [{ data: allPieces }, { data: allExercises }] = await Promise.all([
        supabase.from('pieces').select('id, title, composer, difficulty, completion_pct').eq('student_id', studentId!).eq('status', 'active'),
        supabase.from('exercises').select('id, title, category, difficulty').eq('student_id', studentId!),
      ])

      type PieceRow    = NonNullable<typeof allPieces>[0]
      type ExerciseRow = NonNullable<typeof allExercises>[0]
      const piecesMap: Record<string, PieceRow>    = {}
      const exercisesMap: Record<string, ExerciseRow> = {}
      ;(allPieces ?? []).forEach(p => { piecesMap[p.id] = p })
      ;(allExercises ?? []).forEach(e => { exercisesMap[e.id] = e })

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

      const neededPieceIds    = new Set<string>()
      const neededExerciseIds = new Set<string>()
      for (const prog of selected) {
        if (prog.type === 'regular') {
          ;(allPieces ?? []).filter(p => p.completion_pct < 100).forEach(p => neededPieceIds.add(p.id))
          ;(allExercises ?? []).forEach(e => neededExerciseIds.add(e.id))
        } else {
          progPieces   .filter(x => x.program_id === prog.id).forEach(x => neededPieceIds.add(x.piece_id))
          progExercises.filter(x => x.program_id === prog.id).forEach(x => neededExerciseIds.add(x.exercise_id))
        }
      }

      const pieceIds    = [...neededPieceIds]
      const exerciseIds = [...neededExerciseIds]
      const fetchCi: Promise<{ data: any[] | null }>[] = []
      if (pieceIds.length    > 0) fetchCi.push(supabase.from('checklist_items').select('id, title, is_optional, piece_id, exercise_id').in('piece_id',    pieceIds)    as any)
      if (exerciseIds.length > 0) fetchCi.push(supabase.from('checklist_items').select('id, title, is_optional, piece_id, exercise_id').in('exercise_id', exerciseIds) as any)

      const ciResults = await Promise.all(fetchCi)
      const checklistItems: Array<{ id: string; title: string; is_optional: boolean; piece_id: string | null; exercise_id: string | null }> =
        ciResults.flatMap(r => r.data ?? [])

      const ciByPiece:    Record<string, typeof checklistItems> = {}
      const ciByExercise: Record<string, typeof checklistItems> = {}
      for (const ci of checklistItems) {
        if (ci.piece_id)    { ciByPiece   [ci.piece_id]    ??= []; ciByPiece   [ci.piece_id]   .push(ci) }
        if (ci.exercise_id) { ciByExercise[ci.exercise_id] ??= []; ciByExercise[ci.exercise_id].push(ci) }
      }

      const { data: completionData } = await supabase
        .from('checklist_completions').select('checklist_item_id').eq('student_id', studentId!)
      const completedIds = new Set((completionData ?? []).map(c => c.checklist_item_id as string))

      function buildItems(
        sourceType: 'piece' | 'exercise', sourceId: string, sourceTitle: string,
        completion: number, difficulty: number | null, priorityOverride: number | null,
        ciList: typeof checklistItems,
      ): ResolvedProgramItem[] {
        return ciList.map(ci => ({
          checklistItemId: ci.id, checklistItemTitle: ci.title,
          sourceType, sourceId, sourceTitle,
          sourceCompletion: completion, sourceDifficulty: difficulty,
          isOptional: ci.is_optional, priorityOverride,
        }))
      }

      const resolvedPrograms: ResolvedProgram[] = selected.map(prog => {
        const items: ResolvedProgramItem[] = []
        if (prog.type === 'regular') {
          ;(allPieces ?? []).filter(p => p.completion_pct < 100).forEach(p => {
            items.push(...buildItems('piece', p.id, p.title, p.completion_pct, p.difficulty, null, ciByPiece[p.id] ?? []))
          })
          ;(allExercises ?? []).forEach(e => {
            items.push(...buildItems('exercise', e.id, e.title, 0, e.difficulty, null, ciByExercise[e.id] ?? []))
          })
        } else {
          progPieces.filter(x => x.program_id === prog.id).forEach(pp => {
            const p = piecesMap[pp.piece_id]
            if (!p || p.completion_pct >= 100) return
            items.push(...buildItems('piece', p.id, p.title, p.completion_pct, p.difficulty, pp.priority_override, ciByPiece[p.id] ?? []))
          })
          progExercises.filter(x => x.program_id === prog.id).forEach(pe => {
            const e = exercisesMap[pe.exercise_id]
            if (!e) return
            items.push(...buildItems('exercise', e.id, e.title, 0, e.difficulty, pe.priority_override, ciByExercise[e.id] ?? []))
          })
        }
        return { id: prog.id, title: prog.title, type: prog.type, deadline: prog.deadline, weight: weights[prog.id] ?? 0, items }
      })

      let maintenancePieces: MaintenancePiece[] = []
      if (maintenanceEnabled) {
        const donePieces = (allPieces ?? []).filter(p => p.completion_pct >= 100)
        if (donePieces.length > 0) {
          const doneIds = donePieces.map(p => p.id)
          const { data: maintHistory } = await supabase
            .from('plan_items').select('piece_id, weekly_plan:weekly_plans!plan_id(week_start)')
            .eq('is_maintenance', true).in('piece_id', doneIds)
          const lastMaint: Record<string, string> = {}
          for (const row of maintHistory ?? []) {
            const ws = (row.weekly_plan as any)?.week_start as string | undefined
            if (ws && (!lastMaint[row.piece_id] || ws > lastMaint[row.piece_id])) lastMaint[row.piece_id] = ws
          }
          maintenancePieces = donePieces.map(p => ({
            pieceId: p.id, pieceTitle: p.title, difficulty: p.difficulty,
            lastMaintenanceOn: lastMaint[p.id] ?? null,
          }))
        }
      }

      const plan = generatePlan({
        weekStart, horizon, availability, programs: resolvedPrograms,
        completedItemIds: completedIds, includeRevision,
        maintenance: { enabled: maintenanceEnabled, budgetPercent: maintenanceBudget, completedPieces: maintenancePieces },
      })

      // Build deduplicated picker items for the add-task sheet
      const seen = new Set<string>()
      const picker: PickerItem[] = resolvedPrograms.flatMap(prog =>
        prog.items
          .filter(item => { if (seen.has(item.checklistItemId)) return false; seen.add(item.checklistItemId); return true })
          .map(item => ({ item, programId: prog.id, programTitle: prog.title }))
      )

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

  // ── Task mutation helpers ─────────────────────────────────────────────────

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
        minutesAvailable: 0, minutesUsed: task.durationMinutes, tasks: [task],
      }]
    })
    setAddingToDay(null)
    setAddCustomTitle('')
    setAddCustomDuration(15)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
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
            .from('weekly_plans').insert({ student_id: studentId!, week_start: ws }).select('id').single()
          if (err || !created) throw err ?? new Error('Erro ao criar plano semanal.')
          planId = created.id
        }

        const rows: object[] = []
        for (const day of editableDays.filter(d => d.weekStart === ws)) {
          day.tasks.forEach((task, pos) => {
            rows.push({
              plan_id: planId,
              piece_id: task.sourceType !== 'exercise' ? task.sourceId || null : null,
              checklist_item_id: task.checklistItemId,
              program_id: task.programId,
              day_of_week: day.dayOfWeek,
              duration_minutes: task.durationMinutes,
              is_done: false,
              position: pos,
              is_maintenance: task.isMaintenance,
            })
          })
        }
        if (rows.length > 0) {
          const { error: err } = await supabase.from('plan_items').insert(rows)
          if (err) throw err
        }
      }
      toast.success('Planejamento salvo!')
      navigate(`/professor/alunos/${studentId}?tab=programs`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  // ── Drag-to-scroll ───────────────────────────────────────────────────────

  const scrollRef    = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const dragStartX   = useRef(0)
  const dragScrollL  = useRef(0)
  const [grabbing, setGrabbing] = useState(false)

  function onBoardMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!scrollRef.current) return
    isDragging.current  = true
    dragStartX.current  = e.clientX
    dragScrollL.current = scrollRef.current.scrollLeft
    setGrabbing(true)
  }
  function onBoardMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDragging.current || !scrollRef.current) return
    e.preventDefault()
    const dx = e.clientX - dragStartX.current
    scrollRef.current.scrollLeft = dragScrollL.current - dx * 1.4
  }
  function onBoardMouseUp()    { isDragging.current = false; setGrabbing(false) }
  function onBoardMouseLeave() { isDragging.current = false; setGrabbing(false) }

  // ── Derived preview data ──────────────────────────────────────────────────

  const weekStarts      = [...new Set(editableDays.map(d => d.weekStart))].sort()
  const currentWS       = weekStarts[selectedWeekIdx] ?? weekStart
  const totalScheduled  = editableDays.reduce((s, d) => s + d.tasks.length, 0)
  const totalMinutes    = editableDays.reduce((s, d) => s + d.minutesUsed, 0)

  // 7 columns Mon→Sun for the current week
  const columns = DAY_ORDER.map((dow, i) => {
    const date = dayDateFromWeekStart(currentWS, dow)
    const day  = editableDays.find(d => d.date === date) ?? null
    return { dow, date, label: DAY_LABELS[i], day }
  })

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>

  // ── Config step ───────────────────────────────────────────────────────────

  if (step === 'config') {
    return (
      <TeacherLayout>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(`/professor/alunos/${studentId}?tab=programs`)} className="text-gray-400 hover:text-gray-600 transition">
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
          <div className="max-w-xl mx-auto space-y-5">
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{TYPE_EMOJI[prog.type] ?? '📁'} {prog.title}</p>
                          {prog.deadline && (
                            <p className="text-xs text-gray-400">
                              {new Date(prog.deadline + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </div>
                        {sel && (
                          <div className="flex items-center gap-1 shrink-0">
                            <input type="number" min={0} max={100} value={weights[prog.id] ?? 0}
                              onChange={e => setWeights(w => ({ ...w, [prog.id]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                              className="w-12 text-center text-sm border border-gray-200 rounded-lg px-1 py-1 outline-none focus:border-[#4A90C4]"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )}
                      </div>
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

            {/* Opções */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">Opções</h2>
              <button onClick={() => setIncludeRevision(v => !v)} className="w-full flex items-center gap-3 text-left">
                {includeRevision ? <MdCheckBox size={20} className="text-[#4A90C4] shrink-0" /> : <MdCheckBoxOutlineBlank size={20} className="text-gray-300 shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-gray-700">Incluir revisão</p>
                  <p className="text-xs text-gray-400">Itens já concluídos entram com menor prioridade</p>
                </div>
              </button>
              {hasCompletedPieces && (
                <div className="space-y-2">
                  <button onClick={() => setMaintenanceEnabled(v => !v)} className="w-full flex items-center gap-3 text-left">
                    {maintenanceEnabled ? <MdCheckBox size={20} className="text-[#4A90C4] shrink-0" /> : <MdCheckBoxOutlineBlank size={20} className="text-gray-300 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-700">Manutenção de repertório concluído</p>
                      <p className="text-xs text-gray-400">Peças com 100% revisitadas em ciclo rotativo</p>
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
              )}
            </div>

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

  // ── Preview step ──────────────────────────────────────────────────────────

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

      {/* Stats */}
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

      {/* ── Responsive board ─────────────────────────────────────────────── */}
      {/* Mobile: vertical stack · Tablet/Desktop: horizontal 7 columns      */}
      <div
        ref={scrollRef}
        className={`scrollbar-plan mb-4 pb-4 rounded-b-xl ${grabbing ? 'cursor-grabbing select-none' : 'md:cursor-grab'}`}
        onMouseDown={onBoardMouseDown}
        onMouseMove={onBoardMouseMove}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseLeave}
      >
        <div className="flex flex-col md:flex-row md:min-w-max gap-3">
          {columns.map(col => {
            const tasks = col.day?.tasks ?? []
            const minutesUsed = col.day?.minutesUsed ?? 0
            const isAvailable = col.day !== null || tasks.length > 0

            return (
              <div key={col.date}
                className={`w-full md:flex-none md:w-80 rounded-2xl border overflow-hidden flex flex-col ${isAvailable ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100'}`}>

                {/* Day header */}
                <div className={`px-4 py-3 border-b flex items-center justify-between ${isAvailable ? 'bg-gray-50 border-gray-100' : 'bg-gray-50 border-gray-100'}`}>
                  <div>
                    <p className={`text-sm font-bold ${isAvailable ? 'text-gray-700' : 'text-gray-300'}`}>{col.label}</p>
                    <p className="text-xs text-gray-400">{shortDate(col.date)}</p>
                  </div>
                  {minutesUsed > 0 && (
                    <span className="text-xs font-semibold text-[#4A90C4]">{minutesUsed} min</span>
                  )}
                </div>

                {/* Tasks */}
                <div className="flex-1 p-3 space-y-2">
                  {tasks.length === 0 && !isAvailable && (
                    <p className="text-xs text-gray-300 text-center py-4">Folga</p>
                  )}
                  {tasks.map((task, i) => (
                    <button key={i} onClick={() => setEditingTask({ date: col.date, idx: i })}
                      className="w-full text-left bg-[#F5F7FA] hover:bg-[#D6E4F0]/60 rounded-xl p-3 transition group">
                      <div className="flex items-start gap-2">
                        <span className="text-sm shrink-0 mt-0.5">{taskIcon(task)}</span>
                        <p className="text-sm font-medium text-gray-700 flex-1 leading-snug line-clamp-2">
                          {taskTitle(task)}
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); deleteTask(col.date, i) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 shrink-0 transition mt-0.5">
                          <MdClose size={14} />
                        </button>
                      </div>
                      {!task.isMaintenance && (
                        <p className="text-xs text-gray-400 mt-1 pl-6 truncate">{task.sourceTitle}</p>
                      )}
                      <p className="text-xs font-semibold text-[#4A90C4] mt-1 pl-6">{task.durationMinutes} min</p>
                    </button>
                  ))}
                </div>

                {/* Add button */}
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

      {/* Action buttons */}
      <div className="flex gap-3 pb-8">
        <Button onClick={() => setStep('config')} variant="outline" className="flex-1 rounded-xl border-gray-200 text-gray-600">
          Voltar
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl">
          {saving ? 'Salvando...' : 'Confirmar e Salvar'}
        </Button>
      </div>

      {/* ── Edit-task bottom sheet ─────────────────────────────────────────── */}
      {editingTask && editTask && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={() => setEditingTask(null)}>
          <div className="bg-white rounded-t-2xl px-6 pt-6 pb-8 w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-base font-bold text-[#1E3A5F] line-clamp-2">{taskTitle(editTask)}</p>
                {!editTask.isMaintenance && (
                  <p className="text-sm text-gray-400 mt-1 truncate">{editTask.sourceTitle}</p>
                )}
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
              <button
                onClick={() => deleteTask(editingTask.date, editingTask.idx)}
                className="flex-1 py-3 rounded-xl border border-red-100 text-red-400 text-sm font-semibold hover:bg-red-50 transition">
                Excluir tarefa
              </button>
              <button
                onClick={() => setEditingTask(null)}
                className="flex-1 py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add-task bottom sheet ──────────────────────────────────────────── */}
      {addingToDay && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={() => setAddingToDay(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg mx-auto max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <p className="text-sm font-bold text-[#1E3A5F]">
                Adicionar tarefa — {DAY_LABELS[DAY_ORDER.indexOf(addingToDay.dow)]} {shortDate(addingToDay.date)}
              </p>
              <button onClick={() => setAddingToDay(null)} className="text-gray-400"><MdClose size={20} /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 pb-3 shrink-0">
              {(['program', 'custom'] as const).map(tab => (
                <button key={tab} onClick={() => setAddTab(tab)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition ${addTab === tab ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {tab === 'program' ? 'Do programa' : 'Personalizado'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {addTab === 'program' ? (
              <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-2">
                {pickerItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhum item disponível.</p>
                ) : (
                  pickerItems.map(({ item, programId, programTitle }) => (
                    <button
                      key={item.checklistItemId}
                      onClick={() => addTaskToDay(addingToDay.date, addingToDay.dow, addingToDay.weekStart, {
                        checklistItemId: item.checklistItemId,
                        checklistItemTitle: item.checklistItemTitle,
                        sourceType: item.sourceType,
                        sourceId: item.sourceId,
                        sourceTitle: item.sourceTitle,
                        programId, programTitle,
                        durationMinutes: 15,
                        isRevision: false,
                        isOptional: item.isOptional,
                        isMaintenance: false,
                        score: 0,
                      })}
                      className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-[#4A90C4] transition"
                    >
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.sourceType === 'exercise' ? '🎯' : '🎵'} {item.checklistItemTitle}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {item.sourceTitle} · {TYPE_EMOJI[programTitle] ?? ''} {programTitle}
                      </p>
                    </button>
                  ))
                )}
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
                    checklistItemId: null,
                    checklistItemTitle: addCustomTitle.trim(),
                    sourceType: 'piece',
                    sourceId: '',
                    sourceTitle: 'Personalizado',
                    programId: null,
                    programTitle: 'Personalizado',
                    durationMinutes: addCustomDuration,
                    isRevision: false,
                    isOptional: false,
                    isMaintenance: false,
                    score: 0,
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
