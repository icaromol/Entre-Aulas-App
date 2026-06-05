import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { getMonday, formatWeekStart, formatWeekLabel } from '@/lib/weekUtils'

interface SessionItem {
  plan_item: {
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
}

const difficultyBadge: Record<string, { emoji: string; color: string }> = {
  easy: { emoji: '😊', color: 'bg-green-50 text-green-700' },
  ok:   { emoji: '😐', color: 'bg-amber-50 text-amber-700' },
  hard: { emoji: '😓', color: 'bg-red-50 text-red-500' },
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
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sessionWeekStart(startedAt: string): string {
  return formatWeekStart(getMonday(new Date(startedAt)))
}

export default function HistoryPage() {
  const { profile } = useAuth()

  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) fetchAll()
  }, [profile])

  async function fetchAll() {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()

    if (!student) { setLoading(false); return }

    const { data } = await supabase
      .from('study_sessions')
      .select(`
        id, started_at, duration_seconds,
        cycle_name, difficulty_felt, notes,
        session_items(
          plan_item:plan_items(
            piece:pieces(title),
            exercise:exercises(title)
          )
        )
      `)
      .eq('student_id', student.id)
      .order('started_at', { ascending: false })

    setSessions(data ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <StudentLayout>
        <p className="text-sm text-gray-400">Carregando...</p>
      </StudentLayout>
    )
  }

  const currentWeekStart = formatWeekStart(getMonday(new Date()))
  const thisWeekSeconds = sessions
    .filter(s => sessionWeekStart(s.started_at) === currentWeekStart)
    .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)

  // Agrupa por semana
  const grouped: Record<string, Session[]> = {}
  for (const s of sessions) {
    const key = sessionWeekStart(s.started_at)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  }
  const weekKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <StudentLayout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1E3A5F]">Histórico</h1>
        <p className="text-sm text-gray-400 mt-0.5">Suas sessões de estudo</p>
      </div>

      {/* Destaque semanal */}
      {thisWeekSeconds > 0 && (
        <div className="bg-[#D6E4F0] rounded-2xl p-4 mb-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 3"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#4A90C4]">Esta semana</p>
            <p className="text-2xl font-bold text-[#1E3A5F]">{fmtWeekTotal(thisWeekSeconds)}</p>
            <p className="text-xs text-[#4A90C4]">de estudo acumulado</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-sm font-semibold text-gray-600">Nenhuma sessão ainda</p>
          <p className="text-xs text-gray-400 mt-1">
            Complete uma sessão de pomodoro para ver o histórico aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {weekKeys.map(weekKey => {
            const weekSessions = grouped[weekKey]
            const weekTotalSecs = weekSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)
            const isCurrentWeek = weekKey === currentWeekStart

            return (
              <div key={weekKey}>
                {/* Cabeçalho da semana */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {isCurrentWeek ? 'Esta semana' : formatWeekLabel(weekKey)}
                  </h2>
                  <span className="text-xs text-gray-400">{fmtWeekTotal(weekTotalSecs)}</span>
                </div>

                <div className="space-y-3">
                  {weekSessions.map(session => {
                    const itemTitles = session.session_items
                      .map(si => si.plan_item?.piece?.title ?? si.plan_item?.exercise?.title)
                      .filter((t): t is string => Boolean(t))

                    const badge = session.difficulty_felt
                      ? difficultyBadge[session.difficulty_felt]
                      : null

                    return (
                      <div key={session.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">
                              {fmtDate(session.started_at)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {session.cycle_name} · {fmtDuration(session.duration_seconds)}
                            </p>
                          </div>
                          {badge && (
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${badge.color}`}>
                              {badge.emoji}
                            </span>
                          )}
                        </div>

                        {itemTitles.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {itemTitles.map((title, i) => (
                              <span
                                key={i}
                                className="text-[11px] bg-[#D6E4F0] text-[#1E3A5F] px-2 py-0.5 rounded-lg font-medium"
                              >
                                {title}
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
