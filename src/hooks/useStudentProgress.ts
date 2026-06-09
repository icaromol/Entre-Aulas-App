import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import {
  getRankFromXp,
  computeStreak,
  grantXp,
  RANKS,
  type Rank,
  type XpAttribute,
  type XpReason,
} from '@/lib/xpHelpers'
import { getMonday, formatWeekStart, getTodayDayOfWeek } from '@/lib/weekUtils'

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface ActiveMission {
  id: string
  title: string
  subtitle: string
  pct: number
  type: 'piece' | 'program'
}

export interface WeeklyMission {
  key: string
  label: string
  xpReward: number
  completed: boolean
  progress: number  // 0–1
  target: number
  current: number
}

export interface StudentProgress {
  studentId: string | null
  xpTotal: number
  xpByAttribute: Partial<Record<XpAttribute, number>>
  rank: {
    current: Rank
    next: Rank | null
    progressPct: number
    xpIntoRank: number
    xpNeeded: number
  }
  streak: number
  achievements: string[]
  activeMissions: ActiveMission[]
  todayMission: {
    total: number
    done: number
    xpReward: number
    completed: boolean
  }
  nextEvent: {
    id: string
    title: string
    type: string
    daysUntil: number
  } | null
  weeklyMissions: WeeklyMission[]
  weekStats: {
    sessions: number
    activeDays: number
    plannedDays: number
    doneItems: number
    totalItems: number
  }
  xpHistory: { week: string; xp: number }[]
  minutesHistory: { week: string; minutes: number }[]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudentProgress(opts?: { studentId?: string }): { progress: StudentProgress | null; loading: boolean } {
  const { profile } = useAuth()
  const [progress, setProgress] = useState<StudentProgress | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (opts?.studentId) {
      load(opts.studentId)
      return
    }
    if (!profile || !profile.studentId) {
      setLoading(false)
      return
    }
    load(undefined)
  }, [profile?.id, opts?.studentId])

  async function load(overrideSid?: string) {
    setLoading(true)

    let sid: string
    if (overrideSid) {
      sid = overrideSid
    } else {
      // 1. Resolver student_id a partir do profile logado
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile!.id)
        .single()

      if (!student) { setLoading(false); return }
      sid = student.id
    }

    const weekStart    = formatWeekStart(getMonday(new Date()))
    const todayDow     = getTodayDayOfWeek()
    const weekStartDt  = new Date(weekStart + 'T00:00:00')
    const weekEndIso   = new Date(weekStartDt.getTime() + 7 * 86400000).toISOString()
    const eightWeeksAgo = new Date(weekStartDt.getTime() - 7 * 7 * 86400000).toISOString().slice(0, 10)

    // 2. Buscar todos os dados em paralelo
    const [
      xpResult,
      achievementsResult,
      sessionsResult,
      piecesResult,
      programasResult,
      completedProgramasResult,
      weekPlanResult,
      weekSessionsResult,
      weekItemsResult,
      minutesHistoryResult,
    ] = await Promise.all([
      supabase
        .from('student_xp_events')
        .select('amount, attribute, reason, created_at, source_id')
        .eq('student_id', sid),

      supabase
        .from('student_achievements')
        .select('achievement_key')
        .eq('student_id', sid),

      supabase
        .from('study_sessions')
        .select('started_at')
        .eq('student_id', sid)
        .order('started_at', { ascending: false })
        .limit(35),

      supabase
        .from('pieces')
        .select('id, title, composer, completion_pct, status')
        .eq('student_id', sid)
        .neq('status', 'archived')
        .lt('completion_pct', 100)
        .order('completion_pct', { ascending: false }),

      supabase
        .from('programas')
        .select('id, title, type, status, deadline')
        .eq('student_id', sid)
        .eq('status', 'active')
        .not('deadline', 'is', null)
        .neq('type', 'regular')
        .order('deadline', { ascending: true }),

      supabase
        .from('programas')
        .select('id')
        .eq('student_id', sid)
        .eq('status', 'completed'),

      supabase
        .from('weekly_plans')
        .select('id')
        .eq('student_id', sid)
        .eq('week_start', weekStart)
        .single(),

      supabase
        .from('study_sessions')
        .select('started_at')
        .eq('student_id', sid)
        .gte('started_at', weekStart + 'T00:00:00')
        .lt('started_at', weekEndIso),

      supabase
        .from('student_xp_events')
        .select('reason, created_at')
        .eq('student_id', sid)
        .eq('reason', 'checklist_item')
        .gte('created_at', weekStart + 'T00:00:00')
        .lt('created_at', weekEndIso),

      supabase
        .from('study_sessions')
        .select('started_at, duration_seconds')
        .eq('student_id', sid)
        .gte('started_at', eightWeeksAgo + 'T00:00:00'),
    ])

    // ─── XP total e por atributo ──────────────────────────────────────────
    const xpEvents  = xpResult.data ?? []
    const xpTotal   = xpEvents.reduce((sum, e) => sum + e.amount, 0)
    const xpByAttribute: Partial<Record<XpAttribute, number>> = {}
    for (const e of xpEvents) {
      if (e.attribute) {
        const attr = e.attribute as XpAttribute
        xpByAttribute[attr] = (xpByAttribute[attr] ?? 0) + e.amount
      }
    }

    // ─── Rank ─────────────────────────────────────────────────────────────
    const rank = getRankFromXp(xpTotal)

    // ─── Streak ───────────────────────────────────────────────────────────
    const streak = computeStreak((sessionsResult.data ?? []).map(s => s.started_at))

    // ─── Conquistas ───────────────────────────────────────────────────────
    const achievements = (achievementsResult.data ?? []).map(r => r.achievement_key)

    // ─── Missões ativas (peças em progresso) ─────────────────────────────
    const activeMissions: ActiveMission[] = (piecesResult.data ?? []).map(p => ({
      id:       p.id,
      title:    p.title,
      subtitle: p.composer ?? '',
      pct:      p.completion_pct ?? 0,
      type:     'piece' as const,
    }))

    // Adiciona programas ativos com deadline (recitais, concertos, etc.)
    for (const prog of (programasResult.data ?? [])) {
      activeMissions.push({
        id:       prog.id,
        title:    prog.title,
        subtitle: typeLabel[prog.type] ?? prog.type,
        pct:      0,  // programas não têm pct direto; futuramente derivado das peças
        type:     'program' as const,
      })
    }

    // ─── Missão do dia + stats semanais de itens ─────────────────────────
    let todayMission = { total: 0, done: 0, xpReward: 20, completed: false }
    let weekItemStats = { doneItems: 0, totalItems: 0, plannedDays: 0 }

    if (weekPlanResult.data) {
      const { data: allWeekItems } = await supabase
        .from('plan_items')
        .select('id, is_done, day_of_week')
        .eq('plan_id', weekPlanResult.data.id)

      const allItems = allWeekItems ?? []
      const dayItems = allItems.filter(i => i.day_of_week === todayDow)
      const total = dayItems.length
      const done  = dayItems.filter(i => i.is_done).length
      todayMission = {
        total,
        done,
        xpReward:  20,
        completed: total > 0 && done === total,
      }
      weekItemStats = {
        doneItems:   allItems.filter(i => i.is_done).length,
        totalItems:  allItems.length,
        plannedDays: new Set(allItems.map(i => i.day_of_week)).size,
      }
    }

    // ─── Próximo evento ───────────────────────────────────────────────────
    let nextEvent: StudentProgress['nextEvent'] = null
    const today = new Date().toISOString().slice(0, 10)

    for (const prog of (programasResult.data ?? [])) {
      if (prog.deadline && prog.deadline >= today) {
        const daysUntil = Math.ceil(
          (new Date(prog.deadline).getTime() - new Date(today).getTime()) / 86400000
        )
        nextEvent = { id: prog.id, title: prog.title, type: prog.type, daysUntil }
        break  // já está ordenado por deadline ASC
      }
    }

    // ─── Missões semanais ─────────────────────────────────────────────────
    const weekSessions   = weekSessionsResult.data ?? []
    const weekDaysStudied = new Set(weekSessions.map(s => s.started_at.slice(0, 10))).size
    const weekPomodoros  = weekSessions.length
    const weekItems      = (weekItemsResult.data ?? []).length

    const weeklyMissions: WeeklyMission[] = [
      {
        key:       'weekly_mission_streak',
        label:     'Estudar 4 dias esta semana',
        xpReward:  75,
        target:    4,
        current:   weekDaysStudied,
        progress:  Math.min(1, weekDaysStudied / 4),
        completed: weekDaysStudied >= 4,
      },
      {
        key:       'weekly_mission_pomodoros',
        label:     'Completar 3 sessões de estudo',
        xpReward:  60,
        target:    3,
        current:   weekPomodoros,
        progress:  Math.min(1, weekPomodoros / 3),
        completed: weekPomodoros >= 3,
      },
      {
        key:       'weekly_mission_items',
        label:     'Marcar 5 itens como concluídos',
        xpReward:  50,
        target:    5,
        current:   weekItems,
        progress:  Math.min(1, weekItems / 5),
        completed: weekItems >= 5,
      },
    ]

    // ─── Grant XP de programas concluídos, missão diária e semanais ─────────
    if (!overrideSid) {
      const today = new Date().toISOString().slice(0, 10)

      // Programas concluídos pelo professor: +1000 XP por programa ainda não concedido
      const alreadyGrantedProgramIds = new Set(
        xpEvents
          .filter(e => e.reason === 'program_completed')
          .map(e => e.source_id)
      )
      for (const prog of (completedProgramasResult.data ?? [])) {
        if (!alreadyGrantedProgramIds.has(prog.id)) {
          grantXp(sid, 'program_completed', prog.id, 'performance')
        }
      }

      // Missão diária: completar todas as tarefas do dia
      if (todayMission.completed) {
        const alreadyGrantedToday = xpEvents.some(
          e => e.reason === 'daily_mission' && e.created_at.startsWith(today)
        )
        if (!alreadyGrantedToday) {
          grantXp(sid, 'daily_mission')
        }
      }

      // Missões semanais
      const grantedThisWeek = new Set(
        xpEvents
          .filter(e => e.created_at >= weekStart + 'T00:00:00' &&
            (e.reason === 'weekly_mission_streak' ||
             e.reason === 'weekly_mission_items' ||
             e.reason === 'weekly_mission_pomodoros'))
          .map(e => e.reason)
      )
      for (const m of weeklyMissions) {
        if (m.completed && !grantedThisWeek.has(m.key)) {
          grantXp(sid, m.key as XpReason)
        }
      }
    }

    // ─── Stats semanais ───────────────────────────────────────────────────
    const weekStats = {
      sessions:    weekPomodoros,
      activeDays:  weekDaysStudied,
      plannedDays: weekItemStats.plannedDays,
      doneItems:   weekItemStats.doneItems,
      totalItems:  weekItemStats.totalItems,
    }

    // ─── Histórico de XP e minutos (8 semanas) ───────────────────────────
    const xpByWeek: Record<string, number> = {}
    for (const e of xpEvents) {
      if (e.created_at >= eightWeeksAgo + 'T00:00:00') {
        const w = formatWeekStart(getMonday(new Date(e.created_at)))
        xpByWeek[w] = (xpByWeek[w] ?? 0) + e.amount
      }
    }
    const minByWeek: Record<string, number> = {}
    for (const s of (minutesHistoryResult.data ?? [])) {
      const w = formatWeekStart(getMonday(new Date(s.started_at)))
      minByWeek[w] = (minByWeek[w] ?? 0) + Math.round((s.duration_seconds ?? 0) / 60)
    }
    const xpHistory: { week: string; xp: number }[] = []
    const minutesHistory: { week: string; minutes: number }[] = []
    let cumulativeXp = 0
    for (let i = 7; i >= 0; i--) {
      const d = new Date(weekStartDt.getTime() - i * 7 * 86400000)
      const w = formatWeekStart(d)
      cumulativeXp += (xpByWeek[w] ?? 0)
      xpHistory.push({ week: w, xp: cumulativeXp })
      minutesHistory.push({ week: w, minutes: minByWeek[w] ?? 0 })
    }

    setProgress({
      studentId:     sid,
      xpTotal,
      xpByAttribute,
      rank,
      streak,
      achievements,
      activeMissions,
      todayMission,
      nextEvent,
      weeklyMissions,
      weekStats,
      xpHistory,
      minutesHistory,
    })
    setLoading(false)
  }

  return { progress, loading }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const typeLabel: Record<string, string> = {
  recital:       'Recital',
  concerto:      'Concerto',
  show:          'Show',
  gravacao:      'Gravação',
  exame:         'Exame',
  participacao:  'Participação',
  outro:         'Outro',
}

/** Retorna os RANKS ordenados para exibir a jornada completa. */
export { RANKS }
