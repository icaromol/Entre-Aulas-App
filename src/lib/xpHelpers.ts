import { supabase } from './supabase'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type XpAttribute =
  | 'tecnica'
  | 'leitura'
  | 'ritmo'
  | 'musicalidade'
  | 'performance'
  | 'percepcao'
  | 'improvisacao'
  | 'teoria'
  | 'historia'

export type XpReason =
  | 'pomodoro_session'
  | 'checklist_item'
  | 'piece_completed'
  | 'program_completed'
  | 'daily_mission'
  | 'weekly_mission_streak'
  | 'weekly_mission_items'
  | 'weekly_mission_pomodoros'

export type Rank = {
  region: string
  level: number | null  // 4, 3, 2, 1 — null para Expert e Mestre
  xpMin: number
  display: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

export const RANKS: Rank[] = [
  { region: 'Aprendiz',     level: 4,    xpMin: 0,       display: 'Aprendiz IV' },
  { region: 'Aprendiz',     level: 3,    xpMin: 250,     display: 'Aprendiz III' },
  { region: 'Aprendiz',     level: 2,    xpMin: 500,     display: 'Aprendiz II' },
  { region: 'Aprendiz',     level: 1,    xpMin: 750,     display: 'Aprendiz I' },
  { region: 'Estudante',    level: 4,    xpMin: 1000,    display: 'Estudante IV' },
  { region: 'Estudante',    level: 3,    xpMin: 2250,    display: 'Estudante III' },
  { region: 'Estudante',    level: 2,    xpMin: 3500,    display: 'Estudante II' },
  { region: 'Estudante',    level: 1,    xpMin: 4750,    display: 'Estudante I' },
  { region: 'Amador',       level: 4,    xpMin: 6000,    display: 'Amador IV' },
  { region: 'Amador',       level: 3,    xpMin: 7500,    display: 'Amador III' },
  { region: 'Amador',       level: 2,    xpMin: 9000,    display: 'Amador II' },
  { region: 'Amador',       level: 1,    xpMin: 10500,   display: 'Amador I' },
  { region: 'Júnior',       level: 4,    xpMin: 12000,   display: 'Júnior IV' },
  { region: 'Júnior',       level: 3,    xpMin: 15250,   display: 'Júnior III' },
  { region: 'Júnior',       level: 2,    xpMin: 18500,   display: 'Júnior II' },
  { region: 'Júnior',       level: 1,    xpMin: 21750,   display: 'Júnior I' },
  { region: 'Profissional', level: 4,    xpMin: 25000,   display: 'Profissional IV' },
  { region: 'Profissional', level: 3,    xpMin: 31250,   display: 'Profissional III' },
  { region: 'Profissional', level: 2,    xpMin: 37500,   display: 'Profissional II' },
  { region: 'Profissional', level: 1,    xpMin: 43750,   display: 'Profissional I' },
  { region: 'Expert',       level: null, xpMin: 50000,   display: 'Expert' },
  { region: 'Mestre',       level: null, xpMin: 100000,  display: 'Mestre' },
]

// Mapeia categoria de exercício (banco) → atributo de XP
export const EXERCISE_ATTRIBUTE_MAP: Record<string, XpAttribute> = {
  technique:     'tecnica',
  ear_training:  'percepcao',
  harmony:       'teoria',
  improvisation: 'improvisacao',
  history:       'historia',
  other:         'tecnica',      // fallback
}

// XP concedido por tipo de evento
export const XP_AMOUNTS: Record<XpReason, number> = {
  pomodoro_session:          5,
  checklist_item:            15,
  piece_completed:           300,
  program_completed:         1000,
  daily_mission:             20,
  weekly_mission_streak:     75,
  weekly_mission_items:      50,
  weekly_mission_pomodoros:  60,
}

// Chaves de conquistas
export const ACHIEVEMENT_KEYS = {
  FIRST_SESSION:        'first_session',
  FIRST_PIECE:          'first_piece',
  STREAK_3:             'streak_3',
  STREAK_7:             'streak_7',
  STREAK_14:            'streak_14',
  STREAK_30:            'streak_30',
  RANK_ESTUDANTE:       'rank_estudante_4',
  RANK_AMADOR:          'rank_amador_4',
  RANK_JUNIOR:          'rank_junior_4',
  RANK_PROFISSIONAL:    'rank_profissional_4',
  RANK_EXPERT:          'rank_expert',
  RANK_MESTRE:          'rank_mestre',
  FIRST_RECITAL:        'first_recital',
  PIECES_3:             'pieces_3',
  PIECES_5:             'pieces_5',
} as const

export const ACHIEVEMENT_LABEL: Record<string, string> = {
  first_session:        'Primeira sessão concluída',
  first_piece:          'Primeira peça concluída',
  streak_3:             '3 dias seguidos',
  streak_7:             '7 dias seguidos',
  streak_14:            '14 dias seguidos',
  streak_30:            '30 dias seguidos',
  rank_estudante_4:     'Novo rank: Estudante!',
  rank_amador_4:        'Novo rank: Amador!',
  rank_junior_4:        'Novo rank: Júnior!',
  rank_profissional_4:  'Novo rank: Profissional!',
  rank_expert:          'Novo rank: Expert!',
  rank_mestre:          'Rank máximo: Mestre!',
  first_recital:        'Primeiro recital',
  pieces_3:             '3 peças concluídas',
  pieces_5:             '5 peças concluídas',
}

// ─── Funções utilitárias ──────────────────────────────────────────────────────

/** Retorna o rank atual e o próximo com base no XP total. */
export function getRankFromXp(xpTotal: number): {
  current: Rank
  next: Rank | null
  progressPct: number   // 0–100 dentro do rank atual
  xpIntoRank: number    // XP acumulado desde o início do rank atual
  xpNeeded: number      // XP que falta para o próximo rank (0 se Mestre)
} {
  let current = RANKS[0]
  for (const rank of RANKS) {
    if (xpTotal >= rank.xpMin) current = rank
    else break
  }

  const currentIndex = RANKS.indexOf(current)
  const next = RANKS[currentIndex + 1] ?? null

  const xpIntoRank = xpTotal - current.xpMin
  const rankRange  = next ? next.xpMin - current.xpMin : 1
  const progressPct = next ? Math.min(100, Math.floor((xpIntoRank / rankRange) * 100)) : 100
  const xpNeeded   = next ? next.xpMin - xpTotal : 0

  return { current, next, progressPct, xpIntoRank, xpNeeded }
}

// ─── Ações no Supabase ────────────────────────────────────────────────────────

/**
 * Concede XP ao aluno e verifica conquistas.
 * Retorna { newAchievements } com chaves desbloqueadas nessa chamada.
 */
export async function grantXp(
  studentId: string,
  reason: XpReason,
  sourceId: string | null = null,
  attribute: XpAttribute | null = null,
  amountOverride?: number,
): Promise<{ newAchievements: string[] }> {
  const amount = amountOverride ?? XP_AMOUNTS[reason]

  const { error } = await supabase.from('student_xp_events').insert({
    student_id: studentId,
    amount,
    reason,
    source_id:  sourceId,
    attribute,
  })

  if (error) {
    console.error('grantXp error:', error.message)
    return { newAchievements: [] }
  }

  return checkAndGrantAchievements(studentId)
}

/**
 * Verifica conquistas pendentes e insere as que ainda não foram desbloqueadas.
 * Retorna as chaves recém-desbloqueadas (vazio se nenhuma nova).
 */
export async function checkAndGrantAchievements(
  studentId: string,
): Promise<{ newAchievements: string[] }> {
  const newAchievements: string[] = []

  // Busca conquistas já desbloqueadas
  const { data: existing } = await supabase
    .from('student_achievements')
    .select('achievement_key')
    .eq('student_id', studentId)
  const unlocked = new Set((existing ?? []).map(r => r.achievement_key))

  // Busca dados necessários para verificar critérios
  const [xpResult, sessionsResult] = await Promise.all([
    supabase
      .from('student_xp_events')
      .select('amount, reason')
      .eq('student_id', studentId),
    supabase
      .from('study_sessions')
      .select('started_at')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false }),
  ])

  const events   = xpResult.data ?? []
  const sessions = sessionsResult.data ?? []

  const xpTotal      = events.reduce((sum, e) => sum + e.amount, 0)
  const sessionCount = events.filter(e => e.reason === 'pomodoro_session').length
  const piecesCount  = events.filter(e => e.reason === 'piece_completed').length
  const hasRecital   = events.some(e => e.reason === 'program_completed')
  const streak       = computeStreak(sessions.map(s => s.started_at))

  const candidates: { key: string; met: boolean }[] = [
    { key: ACHIEVEMENT_KEYS.FIRST_SESSION,     met: sessionCount >= 1 },
    { key: ACHIEVEMENT_KEYS.FIRST_PIECE,       met: piecesCount >= 1 },
    { key: ACHIEVEMENT_KEYS.PIECES_3,          met: piecesCount >= 3 },
    { key: ACHIEVEMENT_KEYS.PIECES_5,          met: piecesCount >= 5 },
    { key: ACHIEVEMENT_KEYS.STREAK_3,          met: streak >= 3 },
    { key: ACHIEVEMENT_KEYS.STREAK_7,          met: streak >= 7 },
    { key: ACHIEVEMENT_KEYS.STREAK_14,         met: streak >= 14 },
    { key: ACHIEVEMENT_KEYS.STREAK_30,         met: streak >= 30 },
    { key: ACHIEVEMENT_KEYS.FIRST_RECITAL,     met: hasRecital },
    { key: ACHIEVEMENT_KEYS.RANK_ESTUDANTE,    met: xpTotal >= 1000 },
    { key: ACHIEVEMENT_KEYS.RANK_AMADOR,       met: xpTotal >= 6000 },
    { key: ACHIEVEMENT_KEYS.RANK_JUNIOR,       met: xpTotal >= 12000 },
    { key: ACHIEVEMENT_KEYS.RANK_PROFISSIONAL, met: xpTotal >= 25000 },
    { key: ACHIEVEMENT_KEYS.RANK_EXPERT,       met: xpTotal >= 50000 },
    { key: ACHIEVEMENT_KEYS.RANK_MESTRE,       met: xpTotal >= 100000 },
  ]

  const toInsert = candidates
    .filter(c => c.met && !unlocked.has(c.key))
    .map(c => ({ student_id: studentId, achievement_key: c.key }))

  if (toInsert.length > 0) {
    await supabase.from('student_achievements').insert(toInsert)
    newAchievements.push(...toInsert.map(r => r.achievement_key))
  }

  return { newAchievements }
}

/**
 * Calcula streak de dias consecutivos com pelo menos 1 sessão.
 * Recebe array de ISO strings de `started_at`.
 */
export function computeStreak(startedAts: string[]): number {
  if (startedAts.length === 0) return 0

  // Extrai datas únicas (YYYY-MM-DD) em ordem decrescente
  const days = [...new Set(startedAts.map(s => s.slice(0, 10)))]
    .sort()
    .reverse()

  const today    = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Streak só conta se o aluno estudou hoje ou ontem
  if (days[0] !== today && days[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curr = new Date(days[i])
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diffDays === 1) streak++
    else break
  }

  return streak
}
