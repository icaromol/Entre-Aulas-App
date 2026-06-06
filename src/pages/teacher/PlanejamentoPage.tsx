import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdArrowBack, MdAutoAwesome, MdBalance, MdCheck,
  MdCheckBox, MdCheckBoxOutlineBlank, MdWarningAmber,
} from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'
import { getMonday, formatWeekStart, getDayLabel } from '@/lib/weekUtils'
import {
  generatePlan,
  type GeneratedPlan,
  type GeneratedDay,
  type DayAvailability,
  type ResolvedProgram,
  type ResolvedProgramItem,
  type MaintenancePiece,
} from '@/lib/planGenerator'
import type { Programa } from '@/types/programs'

const HORIZON_OPTIONS = [
  { value: 'week'   as const, label: 'Semana',   weeks: 1 },
  { value: 'biweek' as const, label: 'Quinzena', weeks: 2 },
  { value: 'month'  as const, label: 'Mês',      weeks: 4 },
]

const TYPE_EMOJI: Record<string, string> = {
  regular: '📚', recital: '🎭', concerto: '🎹', show: '🎤',
  gravacao: '🎙️', exame: '📋', participacao: '🎵', outro: '📁',
}

export default function PlanejamentoPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  // ── Step & navigation ─────────────────────────────────────────────────────
  const [step, setStep] = useState<'config' | 'preview'>('config')

  // ── Config state ──────────────────────────────────────────────────────────
  const [programs, setPrograms] = useState<Programa[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [horizon, setHorizon] = useState<'week' | 'biweek' | 'month'>('week')
  const [includeRevision, setIncludeRevision] = useState(false)
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceBudget, setMaintenanceBudget] = useState(20)
  const [hasCompletedPieces, setHasCompletedPieces] = useState(false)

  // ── Async state ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Generated plan ────────────────────────────────────────────────────────
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)

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
      // 1 — Availability
      const { data: availData } = await supabase
        .from('student_availability')
        .select('day_of_week, minutes_available')
        .eq('student_id', studentId!)
        .eq('is_active', true)

      const availability: DayAvailability[] = (availData ?? []).map(a => ({
        dayOfWeek: a.day_of_week,
        minutesAvailable: a.minutes_available,
      }))

      if (availability.length === 0) {
        setError('O aluno não tem dias de disponibilidade configurados.')
        return
      }

      const selected = programs.filter(p => selectedIds.has(p.id))
      const nonRegularIds = selected.filter(p => p.type !== 'regular').map(p => p.id)

      // 2 — All pieces / exercises for the student
      const [{ data: allPieces }, { data: allExercises }] = await Promise.all([
        supabase.from('pieces')
          .select('id, title, composer, difficulty, completion_pct')
          .eq('student_id', studentId!)
          .eq('status', 'active'),
        supabase.from('exercises')
          .select('id, title, category, difficulty')
          .eq('student_id', studentId!),
      ])

      type PieceRow    = NonNullable<typeof allPieces>[0]
      type ExerciseRow = NonNullable<typeof allExercises>[0]

      const piecesMap: Record<string, PieceRow>    = {}
      const exercisesMap: Record<string, ExerciseRow> = {}
      ;(allPieces ?? []).forEach(p => { piecesMap[p.id] = p })
      ;(allExercises ?? []).forEach(e => { exercisesMap[e.id] = e })

      // 3 — Program-linked pieces/exercises (non-regular programs only)
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

      // 4 — Collect all piece / exercise IDs we need checklist_items for
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

      // 5 — Checklist items
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

      // 6 — Completed checklist items
      const { data: completionData } = await supabase
        .from('checklist_completions')
        .select('checklist_item_id')
        .eq('student_id', studentId!)

      const completedIds = new Set((completionData ?? []).map(c => c.checklist_item_id as string))

      // 7 — Build ResolvedProgram[]
      function buildItems(
        sourceType: 'piece' | 'exercise',
        sourceId: string,
        sourceTitle: string,
        completion: number,
        difficulty: number | null,
        priorityOverride: number | null,
        ciList: typeof checklistItems,
      ): ResolvedProgramItem[] {
        return ciList.map(ci => ({
          checklistItemId: ci.id,
          checklistItemTitle: ci.title,
          sourceType,
          sourceId,
          sourceTitle,
          sourceCompletion: completion,
          sourceDifficulty: difficulty,
          isOptional: ci.is_optional,
          priorityOverride,
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

      // 8 — Maintenance pieces
      let maintenancePieces: MaintenancePiece[] = []

      if (maintenanceEnabled) {
        const donePieces = (allPieces ?? []).filter(p => p.completion_pct >= 100)

        if (donePieces.length > 0) {
          const doneIds = donePieces.map(p => p.id)

          const { data: maintHistory } = await supabase
            .from('plan_items')
            .select('piece_id, weekly_plan:weekly_plans!plan_id(week_start)')
            .eq('is_maintenance', true)
            .in('piece_id', doneIds)

          const lastMaint: Record<string, string> = {}
          for (const row of maintHistory ?? []) {
            const ws = (row.weekly_plan as any)?.week_start as string | undefined
            if (ws && (!lastMaint[row.piece_id] || ws > lastMaint[row.piece_id])) {
              lastMaint[row.piece_id] = ws
            }
          }

          maintenancePieces = donePieces.map(p => ({
            pieceId: p.id,
            pieceTitle: p.title,
            difficulty: p.difficulty,
            lastMaintenanceOn: lastMaint[p.id] ?? null,
          }))
        }
      }

      // 9 — Run generator
      const plan = generatePlan({
        weekStart,
        horizon,
        availability,
        programs: resolvedPrograms,
        completedItemIds: completedIds,
        includeRevision,
        maintenance: {
          enabled: maintenanceEnabled,
          budgetPercent: maintenanceBudget,
          completedPieces: maintenancePieces,
        },
      })

      setGeneratedPlan(plan)
      setStep('preview')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar planejamento.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!generatedPlan) return
    setSaving(true)
    setError('')
    try {
      const weekStarts = [...new Set(generatedPlan.days.map(d => d.weekStart))]

      for (const ws of weekStarts) {
        // Find or create weekly_plan
        let planId: string

        const { data: existing } = await supabase
          .from('weekly_plans')
          .select('id')
          .eq('student_id', studentId!)
          .eq('week_start', ws)
          .single()

        if (existing) {
          planId = existing.id
          await supabase.from('plan_items').delete().eq('plan_id', planId)
        } else {
          const { data: created, error: err } = await supabase
            .from('weekly_plans')
            .insert({ student_id: studentId!, week_start: ws })
            .select('id')
            .single()
          if (err || !created) throw err ?? new Error('Erro ao criar plano semanal.')
          planId = created.id
        }

        const daysThisWeek = generatedPlan.days.filter(d => d.weekStart === ws)
        const rows: object[] = []

        for (const day of daysThisWeek) {
          day.tasks.forEach((task, pos) => {
            rows.push({
              plan_id:            planId,
              piece_id:           task.sourceType !== 'exercise' ? task.sourceId : null,
              checklist_item_id:  task.checklistItemId,
              program_id:         task.programId,
              day_of_week:        day.dayOfWeek,
              duration_minutes:   task.durationMinutes,
              is_done:            false,
              position:           pos,
              is_maintenance:     task.isMaintenance,
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

  // ── Render helpers ────────────────────────────────────────────────────────

  const horizonLabel = HORIZON_OPTIONS.find(h => h.value === horizon)?.label ?? ''

  function renderTask(task: GeneratedDay['tasks'][0], idx: number) {
    const bg = task.isMaintenance ? 'bg-[#D6E4F0]/40' : 'bg-white'
    const icon = task.isMaintenance ? '🔄' : task.sourceType === 'exercise' ? '🎯' : '🎵'

    return (
      <div key={idx} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${bg}`}>
        <span className="text-base mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {task.isMaintenance ? `Manutenção — ${task.sourceTitle}` : task.checklistItemTitle}
          </p>
          {!task.isMaintenance && (
            <p className="text-xs text-gray-400 truncate">
              {task.sourceTitle}
              {task.programTitle && (
                <> · <span className="text-[#4A90C4]">{TYPE_EMOJI[task.programTitle] ?? ''} {task.programTitle}</span></>
              )}
            </p>
          )}
          {task.isRevision && (
            <span className="text-[10px] bg-amber-50 text-amber-600 rounded px-1">revisão</span>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{task.durationMinutes}min</span>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <TeacherLayout>
        <p className="text-sm text-gray-400">Carregando...</p>
      </TeacherLayout>
    )
  }

  // ── Config step ───────────────────────────────────────────────────────────

  if (step === 'config') {
    return (
      <TeacherLayout>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(`/professor/alunos/${studentId}?tab=programs`)}
            className="text-gray-400 hover:text-gray-600 transition">
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
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {TYPE_EMOJI[prog.type] ?? '📁'} {prog.title}
                          </p>
                          {prog.deadline && (
                            <p className="text-xs text-gray-400">
                              {new Date(prog.deadline + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </div>
                        {sel && (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={weights[prog.id] ?? 0}
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

              {/* Weight total indicator */}
              {selectedIds.size > 0 && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${
                  weightOk ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                }`}>
                  {weightOk ? <MdCheck size={14} /> : <MdWarningAmber size={14} />}
                  {weightOk
                    ? 'Os pesos somam 100% — tudo certo!'
                    : `Os pesos somam ${totalWeight}%. Ajuste para chegar a 100%.`}
                </div>
              )}
            </div>

            {/* Horizonte */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">Horizonte de planejamento</h2>
              <div className="grid grid-cols-3 gap-2">
                {HORIZON_OPTIONS.map(h => (
                  <button key={h.value} onClick={() => setHorizon(h.value)}
                    className={`py-2 rounded-xl border text-sm font-medium transition ${
                      horizon === h.value
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                    }`}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opções */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">Opções</h2>

              <button onClick={() => setIncludeRevision(v => !v)}
                className="w-full flex items-center gap-3 text-left">
                {includeRevision
                  ? <MdCheckBox size={20} className="text-[#4A90C4] shrink-0" />
                  : <MdCheckBoxOutlineBlank size={20} className="text-gray-300 shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-gray-700">Incluir revisão</p>
                  <p className="text-xs text-gray-400">Itens já concluídos entram com menor prioridade</p>
                </div>
              </button>

              {hasCompletedPieces && (
                <div className="space-y-2">
                  <button onClick={() => setMaintenanceEnabled(v => !v)}
                    className="w-full flex items-center gap-3 text-left">
                    {maintenanceEnabled
                      ? <MdCheckBox size={20} className="text-[#4A90C4] shrink-0" />
                      : <MdCheckBoxOutlineBlank size={20} className="text-gray-300 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-700">Manutenção de repertório concluído</p>
                      <p className="text-xs text-gray-400">Peças com 100% revisitadas em ciclo rotativo</p>
                    </div>
                  </button>

                  {maintenanceEnabled && (
                    <div className="ml-8 flex items-center gap-3">
                      <input
                        type="range"
                        min={10}
                        max={40}
                        step={5}
                        value={maintenanceBudget}
                        onChange={e => setMaintenanceBudget(Number(e.target.value))}
                        className="flex-1 accent-[#4A90C4]"
                      />
                      <span className="text-sm font-semibold text-[#1E3A5F] w-8">{maintenanceBudget}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              onClick={handleGenerate}
              disabled={!weightOk || generating}
              className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10 flex items-center gap-2">
              <MdAutoAwesome size={16} />
              {generating ? 'Gerando...' : `Gerar preview — ${horizonLabel}`}
            </Button>
          </div>
        )}
      </TeacherLayout>
    )
  }

  // ── Preview step ──────────────────────────────────────────────────────────

  const plan = generatedPlan!
  const totalScheduled  = plan.stats.scheduledTasks
  const totalUnscheduled = plan.unscheduled.length

  // Group days by week
  const byWeek = plan.days.reduce<Record<string, GeneratedDay[]>>((acc, d) => {
    ;(acc[d.weekStart] ??= []).push(d)
    return acc
  }, {})

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep('config')} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </button>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Preview do Planejamento</h1>
      </div>

      <div className="max-w-xl mx-auto space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Tarefas', value: totalScheduled },
            { label: 'Semanas',  value: plan.stats.periodsGenerated },
            { label: 'Minutos',  value: plan.stats.totalMinutes },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-[#1E3A5F]">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Overflow warning */}
        {totalUnscheduled > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            <MdWarningAmber size={18} className="text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">
              <span className="font-semibold">{totalUnscheduled} {totalUnscheduled === 1 ? 'item não coube' : 'itens não couberam'}</span> no período disponível.
              Considere reduzir frequência ou aumentar a disponibilidade do aluno.
            </p>
          </div>
        )}

        {/* Days grouped by week */}
        {Object.entries(byWeek).map(([ws, days]) => (
          <div key={ws} className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
              Semana de {new Date(ws + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </h3>
            {days.map(day => (
              <div key={day.date} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <p className="text-sm font-semibold text-[#1E3A5F]">
                    {getDayLabel(day.dayOfWeek)} —{' '}
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                  <span className="text-xs text-gray-400">{day.minutesUsed}min</span>
                </div>
                {day.tasks.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-400">Sem tarefas neste dia.</p>
                ) : (
                  day.tasks.map((task, i) => renderTask(task, i))
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Unscheduled */}
        {totalUnscheduled > 0 && (
          <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-50 bg-amber-50">
              <p className="text-sm font-semibold text-amber-700">Itens não incluídos</p>
            </div>
            {plan.unscheduled.map((task, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">{task.checklistItemTitle}</p>
                  <p className="text-xs text-gray-400 truncate">{task.sourceTitle}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <Button onClick={() => setStep('config')} variant="outline"
            className="flex-1 rounded-xl border-gray-200 text-gray-600">
            Ajustar
          </Button>
          <Button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl">
            {saving ? 'Salvando...' : 'Confirmar e Salvar'}
          </Button>
        </div>
      </div>
    </TeacherLayout>
  )
}
