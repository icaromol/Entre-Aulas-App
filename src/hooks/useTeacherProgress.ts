import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import {
  computeTeacherRank,
  computeWeekStreak,
  grantTeacherXp,
  type TeacherRank,
} from '@/lib/teacherXpHelpers'
import { getMonday, formatWeekStart } from '@/lib/weekUtils'

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface TeacherWeeklyMission {
  key: string
  label: string
  xpReward: number
  completed: boolean
  progress: number
  target: number
  current: number
}

export interface TopStudent {
  studentId: string
  name: string
  xpThisWeek: number
  minutesThisWeek: number
}

export interface TeacherProgress {
  teacherId: string | null
  xpTotal: number
  rank: {
    current: TeacherRank
    next: TeacherRank | null
    progressPct: number
    xpIntoRank: number
    xpNeeded: number
  }
  weekStreak: number
  achievements: string[]
  weeklyMissions: TeacherWeeklyMission[]
  classStats: {
    activeStudents: number
    studentsWithSessions: number
    plansCreatedThisWeek: number
    itemsDoneThisWeek: number
    totalItemsThisWeek: number
    totalMinutesThisWeek: number
  }
  topStudents: TopStudent[]
  xpHistory: { week: string; xp: number }[]
  plansHistory: { week: string; plans: number }[]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTeacherProgress(): { progress: TeacherProgress | null; loading: boolean } {
  const { profile } = useAuth()
  const [progress, setProgress] = useState<TeacherProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const prevMissionsDone = useRef(0)

  useEffect(() => {
    if (!profile || profile.role !== 'teacher') {
      setLoading(false)
      return
    }
    load()
  }, [profile?.id])

  async function load() {
    setLoading(true)

    // 1. Resolver teacher_id
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()

    if (!teacher) { setLoading(false); return }
    const tid = teacher.id

    const weekStart = formatWeekStart(getMonday(new Date()))
    const weekStartDt = new Date(weekStart + 'T00:00:00')
    const weekEndIso = new Date(weekStartDt.getTime() + 7 * 86400000).toISOString()
    const eightWeeksAgo = new Date(weekStartDt.getTime() - 7 * 7 * 86400000).toISOString().slice(0, 10)

    // 2. Buscar students ativos
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('teacher_id', tid)
      .eq('status', 'active')

    const students = studentsData ?? []
    const studentIds = students.map(s => s.id)

    // 3. Buscar restante em paralelo
    const [
      xpResult,
      achievementsResult,
      allPlansResult,
      thisWeekPlansResult,
      sessionsResult,
      xpHistoryResult,
      studentXpResult,
    ] = await Promise.all([
      supabase
        .from('teacher_xp_events')
        .select('amount, created_at')
        .eq('teacher_id', tid),

      supabase
        .from('teacher_achievements')
        .select('achievement_key')
        .eq('teacher_id', tid),

      supabase
        .from('weekly_plans')
        .select('id, week_start, created_at, students!inner(teacher_id)')
        .eq('students.teacher_id', tid),

      supabase
        .from('weekly_plans')
        .select('id, students!inner(teacher_id)')
        .eq('students.teacher_id', tid)
        .gte('created_at', weekStart + 'T00:00:00')
        .lt('created_at', weekEndIso),

      studentIds.length > 0
        ? supabase
          .from('study_sessions')
          .select('student_id, started_at, duration_seconds')
          .in('student_id', studentIds)
          .gte('started_at', weekStart + 'T00:00:00')
          .lt('started_at', weekEndIso)
        : Promise.resolve({ data: [] }),

      supabase
        .from('teacher_xp_events')
        .select('amount, created_at')
        .eq('teacher_id', tid)
        .gte('created_at', eightWeeksAgo + 'T00:00:00'),

      studentIds.length > 0
        ? supabase
          .from('student_xp_events')
          .select('student_id, amount')
          .in('student_id', studentIds)
          .gte('created_at', weekStart + 'T00:00:00')
          .lt('created_at', weekEndIso)
        : Promise.resolve({ data: [] }),
    ])

    // ─── XP total ─────────────────────────────────────────────────────────
    const xpEvents = xpResult.data ?? []
    const xpTotal = xpEvents.reduce((sum, e) => sum + e.amount, 0)
    const rank = computeTeacherRank(xpTotal)

    // ─── Conquistas ───────────────────────────────────────────────────────
    const achievements = (achievementsResult.data ?? []).map(r => r.achievement_key)

    // ─── Streak de semanas ────────────────────────────────────────────────
    const allPlans = allPlansResult.data ?? []
    const weekStarts = [...new Set(allPlans.map(p => p.week_start))].sort().reverse()
    const weekStreak = computeWeekStreak(weekStarts)

    // ─── Plan items desta semana ──────────────────────────────────────────
    const thisWeekPlanIds = (thisWeekPlansResult.data ?? []).map(p => p.id)
    let itemsDoneThisWeek = 0
    let totalItemsThisWeek = 0

    if (thisWeekPlanIds.length > 0) {
      const { data: items } = await supabase
        .from('plan_items')
        .select('is_done')
        .in('plan_id', thisWeekPlanIds)
      const allItems = items ?? []
      itemsDoneThisWeek = allItems.filter(i => i.is_done).length
      totalItemsThisWeek = allItems.length
    }

    // ─── Stats de sessões ─────────────────────────────────────────────────
    const sessions = sessionsResult.data ?? []
    const studentsWithSessions = new Set(sessions.map(s => s.student_id)).size
    const totalMinutesThisWeek = Math.round(
      sessions.reduce((sum, s) => sum + ((s.duration_seconds ?? 0) / 60), 0)
    )

    // ─── Top students (XP esta semana) ────────────────────────────────────
    const xpByStudent: Record<string, number> = {}
    for (const e of (studentXpResult.data ?? [])) {
      xpByStudent[e.student_id] = (xpByStudent[e.student_id] ?? 0) + e.amount
    }
    const minutesByStudent: Record<string, number> = {}
    for (const s of sessions) {
      minutesByStudent[s.student_id] = (minutesByStudent[s.student_id] ?? 0) + Math.round((s.duration_seconds ?? 0) / 60)
    }
    const topStudents: TopStudent[] = students
      .map(s => ({
        studentId: s.id,
        name: `${s.first_name} ${s.last_name}`.trim(),
        xpThisWeek: xpByStudent[s.id] ?? 0,
        minutesThisWeek: minutesByStudent[s.id] ?? 0,
      }))
      .sort((a, b) => b.xpThisWeek - a.xpThisWeek)
      .slice(0, 5)

    // ─── Histórico 8 semanas ──────────────────────────────────────────────
    const xpByWeek: Record<string, number> = {}
    for (const e of (xpHistoryResult.data ?? [])) {
      const w = formatWeekStart(getMonday(new Date(e.created_at)))
      xpByWeek[w] = (xpByWeek[w] ?? 0) + e.amount
    }
    const plansByWeek: Record<string, number> = {}
    for (const p of allPlans) {
      if (p.created_at >= eightWeeksAgo) {
        const w = formatWeekStart(getMonday(new Date(p.created_at)))
        plansByWeek[w] = (plansByWeek[w] ?? 0) + 1
      }
    }

    const xpHistory: { week: string; xp: number }[] = []
    const plansHistory: { week: string; plans: number }[] = []
    let cumulativeXp = 0
    for (let i = 7; i >= 0; i--) {
      const d = new Date(weekStartDt.getTime() - i * 7 * 86400000)
      const w = formatWeekStart(d)
      cumulativeXp += (xpByWeek[w] ?? 0)
      xpHistory.push({ week: w, xp: cumulativeXp })
      plansHistory.push({ week: w, plans: plansByWeek[w] ?? 0 })
    }

    // ─── Missões semanais ─────────────────────────────────────────────────
    const plansThisWeek = (thisWeekPlansResult.data ?? []).length
    const weeklyMissions: TeacherWeeklyMission[] = [
      {
        key: 'weekly_plans',
        label: 'Criar 2 planejamentos esta semana',
        xpReward: 75,
        target: 2,
        current: plansThisWeek,
        progress: Math.min(1, plansThisWeek / 2),
        completed: plansThisWeek >= 2,
      },
      {
        key: 'students_engaged',
        label: '3 alunos estudaram esta semana',
        xpReward: 75,
        target: 3,
        current: studentsWithSessions,
        progress: Math.min(1, studentsWithSessions / 3),
        completed: studentsWithSessions >= 3,
      },
      {
        key: 'items_completion',
        label: '10 itens concluídos pelos alunos',
        xpReward: 50,
        target: 10,
        current: itemsDoneThisWeek,
        progress: Math.min(1, itemsDoneThisWeek / 10),
        completed: itemsDoneThisWeek >= 10,
      },
    ]

    // Grant missões recém-concluídas (com dedup por semana via source_id=weekStart)
    const doneMissions = weeklyMissions.filter(m => m.completed)
    if (doneMissions.length > prevMissionsDone.current) {
      for (const m of doneMissions) {
        await grantTeacherXp(tid, 'weekly_mission', `${weekStart}_${m.key}`)
      }
      prevMissionsDone.current = doneMissions.length
    }

    setProgress({
      teacherId: tid,
      xpTotal,
      rank,
      weekStreak,
      achievements,
      weeklyMissions,
      classStats: {
        activeStudents: students.length,
        studentsWithSessions,
        plansCreatedThisWeek: plansThisWeek,
        itemsDoneThisWeek,
        totalItemsThisWeek,
        totalMinutesThisWeek,
      },
      topStudents,
      xpHistory,
      plansHistory,
    })
    setLoading(false)
  }

  return { progress, loading }
}
