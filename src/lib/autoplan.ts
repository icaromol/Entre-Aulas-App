import { supabase } from '@/lib/supabase'
import { generatePlan } from '@/lib/planGenerator'
import { getMonday, formatWeekStart } from '@/lib/weekUtils'
import type {
  DayAvailability,
  ResolvedProgram,
  ProgramPiece,
  ProgramExercise,
  MaintenancePiece,
} from '@/lib/planGenerator'

export type AutoPlanResult =
  | { ok: true;  planId: string }
  | { ok: false; reason: 'no_availability' | 'no_programs' | 'error' }

function distributeEqually(count: number): number[] {
  if (count === 0) return []
  const base = Math.floor(100 / count)
  const rem  = 100 - base * count
  return Array.from({ length: count }, (_, i) => (i < rem ? base + 1 : base))
}

export async function autoGeneratePlan(
  studentId: string,
  options?: { weekStart?: string }
): Promise<AutoPlanResult> {
  try {
    const weekStart = options?.weekStart ?? formatWeekStart(getMonday(new Date()))

    // 1. Disponibilidade
    const { data: availData } = await supabase
      .from('student_availability')
      .select('day_of_week, minutes_available')
      .eq('student_id', studentId)
      .eq('is_active', true)

    if (!availData || availData.length === 0) {
      return { ok: false, reason: 'no_availability' }
    }

    const availability: DayAvailability[] = availData.map(a => ({
      dayOfWeek: a.day_of_week,
      minutesAvailable: a.minutes_available,
    }))

    // 2. Nível do aluno
    const { data: studentData } = await supabase
      .from('students')
      .select('level')
      .eq('id', studentId)
      .single()

    const studentLevel = (studentData?.level as 'beginner' | 'intermediate' | 'advanced') ?? 'intermediate'

    // 3. Programas ativos
    const { data: progsData } = await supabase
      .from('programas')
      .select('id, title, type, deadline')
      .eq('student_id', studentId)
      .neq('status', 'archived')

    const progs = progsData ?? []
    if (progs.length === 0) {
      return { ok: false, reason: 'no_programs' }
    }

    // 4. Peças e exercícios
    const [{ data: allPieces }, { data: allExercises }] = await Promise.all([
      supabase
        .from('pieces')
        .select('id, title, difficulty, completion_pct, status')
        .eq('student_id', studentId)
        .in('status', ['in_progress', 'future', 'completed']),
      supabase
        .from('exercises')
        .select('id, title, category, difficulty')
        .eq('student_id', studentId)
        .eq('status', 'active'),
    ])

    // 5. Resolução de program_pieces / program_exercises para não-regular
    const nonRegularIds = progs.filter(p => p.type !== 'regular').map(p => p.id)
    type PPRow = { program_id: string; piece_id: string;    priority_override: number | null }
    type PERow = { program_id: string; exercise_id: string; priority_override: number | null }
    let progPieces:    PPRow[] = []
    let progExercises: PERow[] = []

    if (nonRegularIds.length > 0) {
      const [{ data: pp }, { data: pe }] = await Promise.all([
        supabase.from('program_pieces').select('program_id, piece_id, priority_override').in('program_id', nonRegularIds),
        supabase.from('program_exercises').select('program_id, exercise_id, priority_override').in('program_id', nonRegularIds),
      ])
      progPieces    = pp ?? []
      progExercises = pe ?? []
    }

    const piecesMap:    Record<string, NonNullable<typeof allPieces>[0]>    = {}
    const exercisesMap: Record<string, NonNullable<typeof allExercises>[0]> = {}
    ;(allPieces    ?? []).forEach(p => { piecesMap[p.id]    = p })
    ;(allExercises ?? []).forEach(e => { exercisesMap[e.id] = e })

    // 6. Montar ResolvedProgram[]
    const weights = distributeEqually(progs.length)
    const resolvedPrograms: ResolvedProgram[] = progs.map((prog, idx) => {
      const pieces: ProgramPiece[]    = []
      const exercises: ProgramExercise[] = []

      if (prog.type === 'regular') {
        for (const p of allPieces ?? []) {
          pieces.push({ pieceId: p.id, pieceTitle: p.title, difficulty: p.difficulty, completionPct: p.completion_pct, status: p.status, priorityOverride: null })
        }
        for (const e of allExercises ?? []) {
          exercises.push({ exerciseId: e.id, exerciseTitle: e.title, difficulty: e.difficulty, category: e.category, priorityOverride: null })
        }
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

      return { id: prog.id, title: prog.title, type: prog.type, deadline: prog.deadline, weight: weights[idx], pieces, exercises }
    })

    const completedPieces: MaintenancePiece[] = (allPieces ?? [])
      .filter(p => p.status === 'completed')
      .map(p => ({ pieceId: p.id, pieceTitle: p.title, difficulty: p.difficulty }))

    const hasCompleted = completedPieces.length > 0

    // 7. Gerar plano
    const plan = generatePlan({
      studentLevel,
      weekStart,
      horizon: 'week',
      availability,
      programs: resolvedPrograms,
      maintenance: { enabled: hasCompleted, budgetPercent: 20, completedPieces },
    })

    // 8. Salvar — preserva is_done=true, substitui is_done=false
    const { data: existing } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('student_id', studentId)
      .eq('week_start', weekStart)
      .maybeSingle()

    let planId: string

    if (existing) {
      planId = existing.id
      // Remove apenas tarefas não feitas
      await supabase
        .from('plan_items')
        .delete()
        .eq('plan_id', planId)
        .eq('is_done', false)
    } else {
      const { data: created, error: err } = await supabase
        .from('weekly_plans')
        .insert({ student_id: studentId, week_start: weekStart })
        .select('id')
        .single()
      if (err || !created) throw err ?? new Error('Erro ao criar plano semanal.')
      planId = created.id
    }

    type PlanItemInsert = {
      plan_id:          string
      piece_id:         string | null
      exercise_id:      string | null
      program_id:       string | null
      day_of_week:      number
      duration_minutes: number
      is_done:          boolean
      position:         number
      is_maintenance:   boolean
    }

    const rows: PlanItemInsert[] = []
    for (const day of plan.days) {
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

    return { ok: true, planId }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
