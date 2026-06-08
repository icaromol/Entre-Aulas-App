import { supabase } from './supabase'
import { getMonday, formatWeekStart } from './weekUtils'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TeacherXpReason =
  | 'new_student'
  | 'new_plan'
  | 'new_program'
  | 'student_session'
  | 'weekly_mission'

export interface TeacherRank {
  key: string
  label: string
  xpMin: number
}

// ─── Constantes ──────────────────────────────────────────────────────────────

export const TEACHER_RANKS: TeacherRank[] = [
  { key: 'aspirante_4',    label: 'Aspirante IV',    xpMin: 0 },
  { key: 'aspirante_3',    label: 'Aspirante III',   xpMin: 200 },
  { key: 'aspirante_2',    label: 'Aspirante II',    xpMin: 500 },
  { key: 'aspirante_1',    label: 'Aspirante I',     xpMin: 1000 },
  { key: 'tutor_4',        label: 'Tutor IV',        xpMin: 2000 },
  { key: 'tutor_3',        label: 'Tutor III',       xpMin: 3500 },
  { key: 'tutor_2',        label: 'Tutor II',        xpMin: 5500 },
  { key: 'tutor_1',        label: 'Tutor I',         xpMin: 8000 },
  { key: 'docente_4',      label: 'Docente IV',      xpMin: 12000 },
  { key: 'docente_3',      label: 'Docente III',     xpMin: 18000 },
  { key: 'docente_2',      label: 'Docente II',      xpMin: 25000 },
  { key: 'docente_1',      label: 'Docente I',       xpMin: 35000 },
  { key: 'maestro',        label: 'Maestro',         xpMin: 50000 },
  { key: 'grande_maestro', label: 'Grande Maestro',  xpMin: 100000 },
]

export const TEACHER_XP_AMOUNTS: Record<TeacherXpReason, number> = {
  new_student:     50,
  new_plan:        30,
  new_program:     25,
  student_session:  3,
  weekly_mission:  75,
}

export const TEACHER_ACHIEVEMENT_KEYS = {
  PRIMEIRO_ALUNO:          'primeiro_aluno',
  TURMA_3:                 'turma_3',
  TURMA_5:                 'turma_5',
  TURMA_10:                'turma_10',
  PRIMEIRO_PLANO:          'primeiro_plano',
  PLANEJADOR:              'planejador',
  PLANEJADOR_DEDICADO:     'planejador_dedicado',
  PRIMEIRA_PECA:           'primeira_peca',
  PRIMEIRO_RECITAL:        'primeiro_recital',
  ALUNO_RANK_ESTUDANTE:    'aluno_rank_estudante',
  ALUNO_RANK_PROFISSIONAL: 'aluno_rank_profissional',
  ALUNO_MESTRE:            'aluno_mestre',
  STREAK_4_SEMANAS:        'streak_4_semanas',
  TURMA_ATIVA:             'turma_ativa',
} as const

// ─── Funções utilitárias ──────────────────────────────────────────────────────

export function computeTeacherRank(xpTotal: number): {
  current: TeacherRank
  next: TeacherRank | null
  progressPct: number
  xpIntoRank: number
  xpNeeded: number
} {
  let current = TEACHER_RANKS[0]
  for (const rank of TEACHER_RANKS) {
    if (xpTotal >= rank.xpMin) current = rank
    else break
  }

  const currentIndex = TEACHER_RANKS.indexOf(current)
  const next = TEACHER_RANKS[currentIndex + 1] ?? null

  const xpIntoRank = xpTotal - current.xpMin
  const rankRange = next ? next.xpMin - current.xpMin : 1
  const progressPct = next ? Math.min(100, Math.floor((xpIntoRank / rankRange) * 100)) : 100
  const xpNeeded = next ? next.xpMin - xpTotal : 0

  return { current, next, progressPct, xpIntoRank, xpNeeded }
}

// ─── Ações no Supabase ────────────────────────────────────────────────────────

export async function grantTeacherXp(
  teacherId: string,
  reason: TeacherXpReason,
  sourceId: string | null = null,
): Promise<{ newAchievements: string[] }> {
  // Dedup por source_id para new_plan e weekly_mission
  if (sourceId && (reason === 'weekly_mission' || reason === 'new_plan')) {
    const { data: existing } = await supabase
      .from('teacher_xp_events')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('reason', reason)
      .eq('source_id', sourceId)
      .maybeSingle()
    if (existing) return { newAchievements: [] }
  }

  const amount = TEACHER_XP_AMOUNTS[reason]
  const { error } = await supabase.from('teacher_xp_events').insert({
    teacher_id: teacherId,
    amount,
    reason,
    source_id: sourceId,
  })

  if (error) {
    console.error('grantTeacherXp error:', error.message)
    return { newAchievements: [] }
  }

  return checkAndGrantTeacherAchievements(teacherId)
}

export async function checkAndGrantTeacherAchievements(
  teacherId: string,
): Promise<{ newAchievements: string[] }> {
  const newAchievements: string[] = []

  const { data: existing } = await supabase
    .from('teacher_achievements')
    .select('achievement_key')
    .eq('teacher_id', teacherId)
  const unlocked = new Set((existing ?? []).map(r => r.achievement_key))

  // Buscar student_ids do professor
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
  const studentIds = (students ?? []).map(s => s.id)
  const activeCount = studentIds.length

  // Buscar dados necessários em paralelo
  const [plansResult, piecesResult, studentAchievementsResult, programasResult, sessionsResult] =
    await Promise.all([
      supabase
        .from('weekly_plans')
        .select('id, week_start')
        .eq('teacher_id', teacherId),

      studentIds.length > 0
        ? supabase.from('pieces').select('id').in('student_id', studentIds).eq('completion_pct', 100)
        : Promise.resolve({ data: [] }),

      studentIds.length > 0
        ? supabase.from('student_achievements').select('achievement_key').in('student_id', studentIds)
        : Promise.resolve({ data: [] }),

      studentIds.length > 0
        ? supabase.from('programas').select('id').in('student_id', studentIds).eq('status', 'completed')
        : Promise.resolve({ data: [] }),

      studentIds.length > 0
        ? supabase.from('study_sessions').select('student_id, started_at')
          .in('student_id', studentIds)
          .gte('started_at', formatWeekStart(getMonday(new Date())) + 'T00:00:00')
        : Promise.resolve({ data: [] }),
    ])

  const totalPlans = (plansResult.data ?? []).length
  const hasPieceCompleted = (piecesResult.data ?? []).length > 0
  const hasRecital = (programasResult.data ?? []).length > 0
  const studentAchievementKeys = new Set((studentAchievementsResult.data ?? []).map(r => r.achievement_key))

  // Streak de semanas: semanas consecutivas com plano criado
  const weekStarts = [...new Set((plansResult.data ?? []).map(p => p.week_start))].sort().reverse()
  const weekStreak = computeWeekStreak(weekStarts)

  // Turma ativa: todos os alunos ativos estudaram esta semana
  const studentsWithSession = new Set((sessionsResult.data ?? []).map(s => s.student_id))
  const isTurmaAtiva = activeCount > 0 && studentsWithSession.size >= activeCount

  const candidates: { key: string; met: boolean }[] = [
    { key: TEACHER_ACHIEVEMENT_KEYS.PRIMEIRO_ALUNO,          met: activeCount >= 1 },
    { key: TEACHER_ACHIEVEMENT_KEYS.TURMA_3,                 met: activeCount >= 3 },
    { key: TEACHER_ACHIEVEMENT_KEYS.TURMA_5,                 met: activeCount >= 5 },
    { key: TEACHER_ACHIEVEMENT_KEYS.TURMA_10,                met: activeCount >= 10 },
    { key: TEACHER_ACHIEVEMENT_KEYS.PRIMEIRO_PLANO,          met: totalPlans >= 1 },
    { key: TEACHER_ACHIEVEMENT_KEYS.PLANEJADOR,              met: totalPlans >= 10 },
    { key: TEACHER_ACHIEVEMENT_KEYS.PLANEJADOR_DEDICADO,     met: totalPlans >= 50 },
    { key: TEACHER_ACHIEVEMENT_KEYS.PRIMEIRA_PECA,           met: hasPieceCompleted },
    { key: TEACHER_ACHIEVEMENT_KEYS.PRIMEIRO_RECITAL,        met: hasRecital },
    { key: TEACHER_ACHIEVEMENT_KEYS.ALUNO_RANK_ESTUDANTE,    met: studentAchievementKeys.has('rank_estudante_4') },
    { key: TEACHER_ACHIEVEMENT_KEYS.ALUNO_RANK_PROFISSIONAL, met: studentAchievementKeys.has('rank_profissional_4') },
    { key: TEACHER_ACHIEVEMENT_KEYS.ALUNO_MESTRE,            met: studentAchievementKeys.has('rank_mestre') },
    { key: TEACHER_ACHIEVEMENT_KEYS.STREAK_4_SEMANAS,        met: weekStreak >= 4 },
    { key: TEACHER_ACHIEVEMENT_KEYS.TURMA_ATIVA,             met: isTurmaAtiva },
  ]

  const toInsert = candidates
    .filter(c => c.met && !unlocked.has(c.key))
    .map(c => ({ teacher_id: teacherId, achievement_key: c.key }))

  if (toInsert.length > 0) {
    await supabase.from('teacher_achievements').insert(toInsert)
    newAchievements.push(...toInsert.map(r => r.achievement_key))
  }

  return { newAchievements }
}

export function computeWeekStreak(weekStartsSortedDesc: string[]): number {
  if (weekStartsSortedDesc.length === 0) return 0

  const thisWeek = formatWeekStart(getMonday(new Date()))
  const lastWeek = formatWeekStart(new Date(getMonday(new Date()).getTime() - 7 * 86400000))

  if (weekStartsSortedDesc[0] !== thisWeek && weekStartsSortedDesc[0] !== lastWeek) return 0

  let streak = 1
  for (let i = 1; i < weekStartsSortedDesc.length; i++) {
    const prev = new Date(weekStartsSortedDesc[i - 1])
    const curr = new Date(weekStartsSortedDesc[i])
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diffDays === 7) streak++
    else break
  }
  return streak
}
