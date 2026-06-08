import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import {
  getRankFromXp,
  computeStreak,
  RANKS,
  type Rank,
  type XpAttribute,
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
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudentProgress(): { progress: StudentProgress | null; loading: boolean } {
  const { profile } = useAuth()
  const [progress, setProgress] = useState<StudentProgress | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!profile || profile.role !== 'student') {
      setLoading(false)
      return
    }
    load()
  }, [profile?.id])

  async function load() {
    setLoading(true)

    // 1. Resolver student_id
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()

    if (!student) { setLoading(false); return }
    const sid = student.id

    const weekStart    = formatWeekStart(getMonday(new Date()))
    const todayDow     = getTodayDayOfWeek()
    const weekStartDt  = new Date(weekStart + 'T00:00:00')
    const weekEndIso   = new Date(weekStartDt.getTime() + 7 * 86400000).toISOString()

    // 2. Buscar todos os dados em paralelo
    const [
      xpResult,
      achievementsResult,
      sessionsResult,
      piecesResult,
      programasResult,
      weekPlanResult,
      weekSessionsResult,
      weekItemsResult,
    ] = await Promise.all([
      supabase
        .from('student_xp_events')
        .select('amount, attribute, reason')
        .eq('student_id', sid),

      supabase
        .from('student_achievements')
        .select('achievement_key')
        .eq('student_id', sid),

      supabase
        .from('study_sessions')
        .select('started_at')
        .eq('student_id', sid)
        .order('started_at', { ascending: false }),

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

    // ─── Missão do dia ────────────────────────────────────────────────────
    let todayMission = { total: 0, done: 0, xpReward: 20, completed: false }

    if (weekPlanResult.data) {
      const { data: dayItems } = await supabase
        .from('plan_items')
        .select('id, is_done')
        .eq('plan_id', weekPlanResult.data.id)
        .eq('day_of_week', todayDow)

      const total = (dayItems ?? []).length
      const done  = (dayItems ?? []).filter(i => i.is_done).length
      todayMission = {
        total,
        done,
        xpReward:  20,
        completed: total > 0 && done === total,
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
