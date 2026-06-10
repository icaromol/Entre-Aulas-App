import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdArrowBack, MdAutoAwesome,
  MdCheckBox, MdCheckBoxOutlineBlank, MdAdd,
} from 'react-icons/md'
import { ProportionalSliderGroup } from '@/components/ui/ProportionalSliderGroup'
import { AvailabilityEditor } from '@/components/ui/AvailabilityEditor'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'
import { getMonday, formatWeekStart } from '@/lib/weekUtils'
import {
  generatePlan,
  type DayAvailability,
  type ResolvedProgram,
} from '@/lib/planGenerator'
import type { Programa } from '@/types/programs'
import { PROGRAM_TYPES } from '@/lib/programTypes'

function programIcon(type: string, size = 18) {
  const Icon = (PROGRAM_TYPES[type] ?? PROGRAM_TYPES.outro).Icon
  return <Icon size={size} className="text-white" />
}

export default function StudentPlanejamentoPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const studentId = profile?.studentId

  const [step, setStep] = useState<'availability' | 'config'>('config')

  const [programs, setPrograms]               = useState<Programa[]>([])
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [weights, setWeights]                 = useState<Record<string, number>>({})
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceBudget, setMaintenanceBudget]   = useState(20)
  const [hasCompletedPieces, setHasCompletedPieces] = useState(false)
  const [studentLevel, setStudentLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const weekStart = formatWeekStart(getMonday(new Date()))

  useEffect(() => { if (studentId) fetchPrograms() }, [studentId])

  async function fetchPrograms() {
    const [progsRes, donePiecesRes, studentRes, availRes] = await Promise.all([
      supabase.from('programas').select('*').eq('student_id', studentId!).neq('status', 'archived').order('created_at'),
      supabase.from('pieces').select('id').eq('student_id', studentId!).eq('status', 'completed'),
      supabase.from('students').select('level').eq('id', studentId!).single(),
      supabase.from('student_availability').select('id').eq('student_id', studentId!).eq('is_active', true).limit(1),
    ])
    if (progsRes.error || studentRes.error) {
      setError('Não foi possível carregar os programas. Tente recarregar a página.')
      setLoading(false)
      return
    }
    const list = progsRes.data ?? []
    setPrograms(list)
    setHasCompletedPieces((donePiecesRes.data ?? []).length > 0)
    if ((availRes.data ?? []).length === 0) setStep('availability')
    if (studentRes.data?.level) setStudentLevel(studentRes.data.level as typeof studentLevel)
    const allIds = new Set(list.map(p => p.id))
    setSelectedIds(allIds)
    distributeWeights(allIds, list)
    setLoading(false)
  }

  function distributeWeights(ids: Set<string>, list = programs) {
    if (ids.size === 0) return
    const arr  = [...ids]
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

  const sliderItems = useMemo(
    () => programs.filter(p => selectedIds.has(p.id)).map(p => ({ id: p.id, label: p.title })),
    [programs, selectedIds]
  )

  const handleSliderChange = useCallback((id: string, value: number) => {
    setWeights(w => ({ ...w, [id]: value }))
  }, [])

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      const { data: availData } = await supabase
        .from('student_availability')
        .select('day_of_week, minutes_available')
        .eq('student_id', studentId!)
        .eq('is_active', true)

      const availability: DayAvailability[] = (availData ?? []).map(a => ({
        dayOfWeek: a.day_of_week, minutesAvailable: a.minutes_available,
      }))

      const selected      = programs.filter(p => selectedIds.has(p.id))
      const nonRegularIds = selected.filter(p => p.type !== 'regular').map(p => p.id)

      const [{ data: allPieces }, { data: allExercises }] = await Promise.all([
        supabase.from('pieces').select('id, title, difficulty, completion_pct, status').eq('student_id', studentId!).in('status', ['in_progress', 'future', 'completed']),
        supabase.from('exercises').select('id, title, category, difficulty').eq('student_id', studentId!).eq('status', 'active'),
      ])

      const piecesMap:    Record<string, NonNullable<typeof allPieces>[0]>    = {}
      const exercisesMap: Record<string, NonNullable<typeof allExercises>[0]> = {}
      ;(allPieces    ?? []).forEach(p => { piecesMap[p.id]    = p })
      ;(allExercises ?? []).forEach(e => { exercisesMap[e.id] = e })

      let progPieces:    Array<{ program_id: string; piece_id: string;    priority_override: number | null }> = []
      let progExercises: Array<{ program_id: string; exercise_id: string; priority_override: number | null }> = []
      if (nonRegularIds.length > 0) {
        const [{ data: pp }, { data: pe }] = await Promise.all([
          supabase.from('program_pieces').select('program_id, piece_id, priority_override').in('program_id', nonRegularIds),
          supabase.from('program_exercises').select('program_id, exercise_id, priority_override').in('program_id', nonRegularIds),
        ])
        progPieces    = pp ?? []
        progExercises = pe ?? []
      }

      const resolvedPrograms: ResolvedProgram[] = selected.map(prog => {
        const pieces: ResolvedProgram['pieces'] = []
        const exercises: ResolvedProgram['exercises'] = []
        if (prog.type === 'regular') {
          for (const p of allPieces ?? []) pieces.push({ pieceId: p.id, pieceTitle: p.title, difficulty: p.difficulty, completionPct: p.completion_pct, status: p.status, priorityOverride: null })
          for (const e of allExercises ?? []) exercises.push({ exerciseId: e.id, exerciseTitle: e.title, difficulty: e.difficulty, category: e.category, priorityOverride: null })
        } else {
          for (const pp of progPieces.filter(x => x.program_id === prog.id)) {
            const p = piecesMap[pp.piece_id]; if (!p) continue
            pieces.push({ pieceId: p.id, pieceTitle: p.title, difficulty: p.difficulty, completionPct: p.completion_pct, status: p.status, priorityOverride: pp.priority_override })
          }
          for (const pe of progExercises.filter(x => x.program_id === prog.id)) {
            const e = exercisesMap[pe.exercise_id]; if (!e) continue
            exercises.push({ exerciseId: e.id, exerciseTitle: e.title, difficulty: e.difficulty, category: e.category, priorityOverride: pe.priority_override })
          }
        }
        return { id: prog.id, title: prog.title, type: prog.type, deadline: prog.deadline, weight: weights[prog.id] ?? 0, pieces, exercises }
      })

      const completedPieces = (allPieces ?? [])
        .filter(p => p.status === 'completed')
        .map(p => ({ pieceId: p.id, pieceTitle: p.title, difficulty: p.difficulty }))

      const plan = generatePlan({
        studentLevel, weekStart, horizon: 'week', availability,
        programs: resolvedPrograms,
        maintenance: { enabled: maintenanceEnabled, budgetPercent: maintenanceBudget, completedPieces },
      })

      // Salva preservando is_done=true
      const { data: existing } = await supabase
        .from('weekly_plans').select('id').eq('student_id', studentId!).eq('week_start', weekStart).maybeSingle()

      let planId: string
      if (existing) {
        planId = existing.id
        await supabase.from('plan_items').delete().eq('plan_id', planId).eq('is_done', false)
      } else {
        const { data: created, error: err } = await supabase
          .from('weekly_plans').insert({ student_id: studentId!, week_start: weekStart }).select('id').single()
        if (err || !created) throw err ?? new Error('Erro ao criar plano semanal.')
        planId = created.id
      }

      type PlanItemInsert = {
        plan_id: string; piece_id: string | null; exercise_id: string | null
        program_id: string | null; day_of_week: number; duration_minutes: number
        is_done: boolean; position: number; is_maintenance: boolean
      }
      const rows: PlanItemInsert[] = []
      for (const day of plan.days) {
        day.tasks.forEach((task, pos) => {
          rows.push({
            plan_id: planId, piece_id: task.pieceId, exercise_id: task.exerciseId,
            program_id: task.programId, day_of_week: day.dayOfWeek,
            duration_minutes: task.durationMinutes, is_done: false,
            position: pos, is_maintenance: task.isMaintenance,
          })
        })
      }
      if (rows.length > 0) {
        const { error: err } = await supabase.from('plan_items').insert(rows)
        if (err) throw err
      }

      toast.success('Plano atualizado!')
      navigate('/aluno/hoje')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <StudentLayout><div className="flex justify-center py-12"><Spinner /></div></StudentLayout>

  // ── Availability step ─────────────────────────────────────────────────────────

  if (step === 'availability') {
    return (
      <StudentLayout>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition">
            <MdArrowBack size={20} />
          </button>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Personalize seu plano de estudos</h1>
        </div>
        <div className="space-y-5">
          <div className="bg-[#D6E4F0]/50 border border-[#4A90C4]/20 rounded-2xl px-5 py-4">
            <p className="text-sm font-semibold text-[#1E3A5F] mb-1">Antes de continuar</p>
            <p className="text-xs text-[#1E3A5F]/70 leading-relaxed">
              Configure os dias e o tempo disponível para estudo. O planejamento será gerado com base nisso.
            </p>
          </div>
          {studentId && (
            <AvailabilityEditor
              studentId={studentId}
              onSaved={hasAny => { if (hasAny) setStep('config') }}
            />
          )}
        </div>
      </StudentLayout>
    )
  }

  // ── Config step ──────────────────────────────────────────────────────────────

  return (
    <StudentLayout>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </button>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Personalize seu plano de estudos</h1>
      </div>

      <div className="flex items-start gap-2.5 bg-[#D6E4F0]/60 rounded-2xl px-4 py-3 mb-5 text-sm text-[#1E3A5F]/80 leading-snug">
        <MdAutoAwesome size={16} className="shrink-0 mt-0.5 text-[#4A90C4]" />
        <span>Seu plano é gerado automaticamente toda semana. Use esta tela para personalizar pesos e manutenção.</span>
      </div>

      {programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#D6E4F0] flex items-center justify-center">
            <MdAutoAwesome size={28} className="text-[#1E3A5F]" />
          </div>
          <div>
            <p className="text-base font-bold text-[#1E3A5F] mb-1">Nenhum programa ativo</p>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              Você precisa de ao menos um programa para gerar o planejamento.
            </p>
          </div>
          <Button
            onClick={() => navigate('/aluno/repertorio/programas/novo')}
            className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl px-6 h-11"
          >
            <MdAdd size={18} /> Criar primeiro programa
          </Button>
        </div>
      ) : (
        <div className="space-y-5">

          <div id="onboarding-planning-programs" className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-600">Programas</h2>
            <div className="space-y-2">
              {programs.map(prog => {
                const sel = selectedIds.has(prog.id)
                return (
                  <div key={prog.id}
                    className={`rounded-xl border transition flex items-center gap-3 p-3 ${sel ? 'border-[#4A90C4] bg-[#D6E4F0]/30' : 'border-gray-100 bg-gray-50'}`}>
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
                    {sel && <span className="text-sm font-bold text-[#1E3A5F] shrink-0">{weights[prog.id] ?? 0}%</span>}
                  </div>
                )
              })}
            </div>

            {selectedIds.size > 1 && (
              <div className="pt-2 border-t border-gray-100">
                <ProportionalSliderGroup
                  items={sliderItems}
                  onChange={handleSliderChange}
                />
              </div>
            )}
          </div>

          {hasCompletedPieces && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">Opções</h2>
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
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            id="onboarding-planning-save"
            onClick={handleSave}
            disabled={!weightOk || saving}
            className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-11 flex items-center gap-2"
          >
            <MdAutoAwesome size={16} />
            {saving ? 'Salvando...' : 'Salvar e aplicar'}
          </Button>

        </div>
      )}
    </StudentLayout>
  )
}
