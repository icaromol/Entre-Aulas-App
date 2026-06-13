import { useEffect, useState } from 'react'
import { MdAccessTime, MdStar, MdHistory } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { getMonday, formatWeekStart, formatWeekLabel } from '@/lib/weekUtils'

interface PlanItemJoin {
  is_maintenance: boolean
  piece: { title: string } | null
  exercise: { title: string } | null
}

interface SessionItem {
  plan_item_id: string | null
  custom_label: string | null
  plan_item: PlanItemJoin | null
}

interface ChecklistCompletion {
  checklist_item: {
    title: string
    piece: { title: string } | null
    exercise: { title: string } | null
  } | null
}

interface Session {
  id: string
  started_at: string
  duration_seconds: number
  cycle_name: string
  difficulty_felt: 'easy' | 'ok' | 'hard' | null
  notes: string | null
  session_items: SessionItem[]
  checklist_completions: ChecklistCompletion[]
}

const difficultyBadge: Record<string, { emoji: string; color: string }> = {
  easy: { emoji: '😊', color: 'bg-[#eff7fb] text-[#153b50]' },
  ok:   { emoji: '😐', color: 'bg-[#e5e5e5] text-[#292929]' },
  hard: { emoji: '😓', color: 'bg-[#ffeceb] text-[#ff4c3e]' },
}

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

function fmtWeekTotal(secs: number): string {
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`
}

function fmtDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function sessionWeekStart(startedAt: string): string {
  return formatWeekStart(getMonday(new Date(startedAt)))
}

function planItemLabel(si: SessionItem): string | null {
  if (si.custom_label) return si.custom_label
  const p = si.plan_item
  if (!p) return null
  if (p.is_maintenance) return p.piece?.title ?? 'Manutenção'
  if (p.exercise) return p.exercise.title
  if (p.piece)    return p.piece.title
  return null
}

function checklistLabel(c: ChecklistCompletion): string | null {
  const ci = c.checklist_item
  if (!ci) return null
  const src = ci.piece?.title ?? ci.exercise?.title
  return src ? `${ci.title} — ${src}` : ci.title
}

export default function HistoryPage() {
  const { profile } = useAuth()

  const [sessions, setSessions] = useState<Session[]>([])
  const [xpBySession, setXpBySession] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.studentId) fetchAll(profile.studentId) }, [profile?.studentId])

  async function fetchAll(sid: string) {
    const [sessionsRes, xpRes] = await Promise.all([
      supabase
        .from('study_sessions')
        .select(`
          id, started_at, duration_seconds, cycle_name, difficulty_felt, notes,
          session_items(
            plan_item_id,
            custom_label,
            plan_item:plan_items(
              is_maintenance,
              piece:pieces(title),
              exercise:exercises(title)
            )
          ),
          checklist_completions(
            checklist_item:checklist_items(
              title,
              piece:pieces(title),
              exercise:exercises(title)
            )
          )
        `)
        .eq('student_id', sid)
        .order('started_at', { ascending: false }),
      supabase
        .from('student_xp_events')
        .select('source_id, amount')
        .eq('student_id', sid)
        .eq('reason', 'pomodoro_session'),
    ])

    if (sessionsRes.error) console.error('[history] sessions error', sessionsRes.error)

    setSessions((sessionsRes.data ?? []) as unknown as Session[])

    const xpMap: Record<string, number> = {}
    for (const e of (xpRes.data ?? [])) {
      if (e.source_id) xpMap[e.source_id] = (xpMap[e.source_id] ?? 0) + e.amount
    }
    setXpBySession(xpMap)
    setLoading(false)
  }

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex justify-center py-12"><Spinner /></div>
      </StudentLayout>
    )
  }

  const currentWeekStart = formatWeekStart(getMonday(new Date()))
  const thisWeekSeconds = sessions
    .filter(s => sessionWeekStart(s.started_at) === currentWeekStart)
    .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)

  const grouped: Record<string, Session[]> = {}
  for (const s of sessions) {
    const key = sessionWeekStart(s.started_at)
    ;(grouped[key] ??= []).push(s)
  }
  const weekKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <StudentLayout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#153b50]">Histórico</h1>
        <p className="text-sm text-gray-400 mt-0.5">Suas sessões de estudo</p>
      </div>

      {/* Destaque semanal */}
      {thisWeekSeconds > 0 && (
        <div className="bg-[#f5f5f5] rounded-2xl p-4 mb-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#153b50] flex items-center justify-center shrink-0">
            <MdAccessTime size={22} color="white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#b2f0fb]">Esta semana</p>
            <p className="text-2xl font-bold text-[#153b50]">{fmtWeekTotal(thisWeekSeconds)}</p>
            <p className="text-xs text-[#b2f0fb]">de estudo acumulado</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#153b50] flex items-center justify-center mx-auto mb-3">
            <MdHistory size={24} color="white" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Nenhuma sessão ainda</p>
          <p className="text-xs text-gray-400 mt-1">
            Complete uma sessão de pomodoro para ver o histórico aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {weekKeys.map(weekKey => {
            const weekSessions = grouped[weekKey]
            const weekTotalSecs = weekSessions.reduce((s, sess) => s + (sess.duration_seconds ?? 0), 0)
            const isCurrentWeek = weekKey === currentWeekStart

            return (
              <div key={weekKey}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {isCurrentWeek ? 'Esta semana' : formatWeekLabel(weekKey)}
                  </h2>
                  <span className="text-xs text-gray-400">{fmtWeekTotal(weekTotalSecs)}</span>
                </div>

                <div className="space-y-3">
                  {weekSessions.map(session => {
                    // Labels de itens do planejamento trabalhados
                    const planLabels = session.session_items
                      .map(planItemLabel)
                      .filter((t): t is string => Boolean(t))

                    // Labels de checklist completados nessa sessão
                    const checkLabels = session.checklist_completions
                      .map(checklistLabel)
                      .filter((t): t is string => Boolean(t))

                    // Deduplica: remove checklist labels que já estão cobertos pelo plan label da peça
                    const allLabels = [...new Set([...planLabels, ...checkLabels])]

                    const badge = session.difficulty_felt
                      ? difficultyBadge[session.difficulty_felt]
                      : null

                    const sessionXp = xpBySession[session.id]

                    return (
                      <div key={session.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">
                              Sessão de estudo — {session.cycle_name}
                              <span className="font-normal text-gray-400 ml-1">· {fmtDuration(session.duration_seconds)}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {fmtDate(session.started_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {sessionXp != null && (
                              <span className="flex items-center gap-0.5 text-xs font-semibold text-[#b2f0fb] bg-[#f5f5f5] px-1.5 py-0.5 rounded-md">
                                <MdStar size={11} />
                                +{sessionXp} XP
                              </span>
                            )}
                            {badge && (
                              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${badge.color}`}>
                                {badge.emoji}
                              </span>
                            )}
                          </div>
                        </div>

                        {allLabels.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {allLabels.map((label, i) => (
                              <span key={i} className="text-[11px] bg-[#f5f5f5] text-[#153b50] px-2 py-0.5 rounded-lg font-medium">
                                {label}
                              </span>
                            ))}
                          </div>
                        )}

                        {session.notes && (
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed italic">
                            "{session.notes}"
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </StudentLayout>
  )
}
