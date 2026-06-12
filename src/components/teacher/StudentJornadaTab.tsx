import { useEffect, useState } from 'react'
import { useStudentProgress } from '@/hooks/useStudentProgress'
import { Spinner } from '@/components/ui/Spinner'
import {
  MdWhatshot, MdEmojiEvents, MdLock, MdStar,
  MdMusicNote, MdTimer, MdAccessTime, MdCheckCircle,
} from 'react-icons/md'
import type { XpAttribute } from '@/lib/xpHelpers'
import { supabase } from '@/lib/supabase'
import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis,
  Area, AreaChart,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

// ─── Constantes de exibição ────────────────────────────────────────────────

const ATTRIBUTE_LABEL: Record<XpAttribute, string> = {
  tecnica:       'Técnica',
  leitura:       'Leitura',
  ritmo:         'Ritmo',
  musicalidade:  'Musicalidade',
  performance:   'Performance',
  percepcao:     'Percepção',
  improvisacao:  'Improvisação',
  teoria:        'Teoria Musical',
  historia:      'Hist. da Música',
}

const ATTRIBUTE_ORDER: XpAttribute[] = [
  'tecnica', 'musicalidade', 'percepcao', 'teoria',
  'ritmo', 'leitura', 'performance', 'improvisacao', 'historia',
]

const ALL_ACHIEVEMENTS: { key: string; label: string; category: 'session' | 'piece' | 'streak' | 'rank' | 'event' }[] = [
  { key: 'first_session',        label: 'Primeira sessão',    category: 'session' },
  { key: 'first_piece',          label: 'Primeira peça',      category: 'piece'   },
  { key: 'pieces_3',             label: '3 peças concluídas', category: 'piece'   },
  { key: 'pieces_5',             label: '5 peças concluídas', category: 'piece'   },
  { key: 'first_recital',        label: 'Primeiro recital',   category: 'event'   },
  { key: 'streak_3',             label: '3 dias seguidos',    category: 'streak'  },
  { key: 'streak_7',             label: '7 dias seguidos',    category: 'streak'  },
  { key: 'streak_14',            label: '14 dias seguidos',   category: 'streak'  },
  { key: 'streak_30',            label: '30 dias seguidos',   category: 'streak'  },
  { key: 'rank_estudante_4',     label: 'Estudante',          category: 'rank'    },
  { key: 'rank_amador_4',        label: 'Amador',             category: 'rank'    },
  { key: 'rank_junior_4',        label: 'Júnior',             category: 'rank'    },
  { key: 'rank_profissional_4',  label: 'Profissional',       category: 'rank'    },
  { key: 'rank_expert',          label: 'Expert',             category: 'rank'    },
  { key: 'rank_mestre',          label: 'Mestre',             category: 'rank'    },
]

function AchievementIcon({ category, size = 16 }: { category: string; size?: number }) {
  if (category === 'streak')  return <MdWhatshot size={size} />
  if (category === 'piece')   return <MdMusicNote size={size} />
  if (category === 'session') return <MdTimer size={size} />
  if (category === 'rank')    return <MdEmojiEvents size={size} />
  return <MdStar size={size} />
}

function fmtXp(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n)
}

function shortWeekLabel(isoMonday: string): string {
  const [, m, d] = isoMonday.split('-')
  return `${d}/${m}`
}

const minutesChartConfig = {
  minutes: { label: 'Minutos', color: '#b2f0fb' },
} satisfies ChartConfig

const xpChartConfig = {
  xp: { label: 'XP', color: '#153b50' },
} satisfies ChartConfig

// ─── Tipos e helpers de sessões ──────────────────────────────────────────────

interface RecentSession {
  id: string
  started_at: string
  duration_seconds: number
  cycle_name: string
  difficulty_felt: 'easy' | 'ok' | 'hard' | null
  notes: string | null
  xp: number
}

const difficultyLabel: Record<string, string> = {
  easy: 'Fácil', ok: 'Ok', hard: 'Difícil',
}
const difficultyColor: Record<string, string> = {
  easy: 'bg-green-50 text-green-700',
  ok:   'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-500',
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

function fmtDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  studentId: string
}

export function StudentJornadaTab({ studentId }: Props) {
  const { progress, loading } = useStudentProgress({ studentId })
  const [sessions, setSessions] = useState<RecentSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  useEffect(() => {
    async function fetchSessions() {
      const [sessionsRes, xpRes] = await Promise.all([
        supabase
          .from('study_sessions')
          .select('id, started_at, duration_seconds, cycle_name, difficulty_felt, notes')
          .eq('student_id', studentId)
          .order('started_at', { ascending: false })
          .limit(20),
        supabase
          .from('student_xp_events')
          .select('source_id, amount')
          .eq('student_id', studentId)
          .eq('reason', 'pomodoro_session'),
      ])

      const xpMap: Record<string, number> = {}
      for (const e of (xpRes.data ?? [])) {
        if (e.source_id) xpMap[e.source_id] = (xpMap[e.source_id] ?? 0) + e.amount
      }

      setSessions((sessionsRes.data ?? []).map((s: any) => ({ ...s, xp: xpMap[s.id] ?? 0 })))
      setSessionsLoading(false)
    }
    fetchSessions()
  }, [studentId])

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  if (!progress?.studentId) {
    return (
      <div className="flex flex-col items-center py-16 text-center px-4">
        <MdEmojiEvents size={40} className="text-gray-200 mb-3" />
        <p className="text-sm font-semibold text-gray-600">Nenhum dado de jornada ainda</p>
        <p className="text-xs text-gray-400 mt-1">O aluno precisa completar tarefas para acumular XP.</p>
      </div>
    )
  }

  const { rank, xpTotal, xpByAttribute, streak, achievements, weekStats, xpHistory, minutesHistory } = progress
  const unlockedSet = new Set(achievements)

  const attrValues = ATTRIBUTE_ORDER.map(k => ({ key: k, xp: xpByAttribute[k] ?? 0 }))
  const maxAttr = Math.max(1, ...attrValues.map(a => a.xp))

  const minutesChartData = minutesHistory.map(h => ({
    label: shortWeekLabel(h.week),
    minutes: h.minutes,
  }))

  const xpChartData = xpHistory.map(h => ({
    label: shortWeekLabel(h.week),
    xp: h.xp,
  }))

  const pendingItems = weekStats.totalItems - weekStats.doneItems

  return (
    <div className="space-y-4 pb-4">

      {/* Rank + XP */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank atual</p>
          <p className="text-lg font-bold text-[#153b50] mt-0.5">{rank.current.display}</p>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#b2f0fb] rounded-full transition-all duration-700"
            style={{ width: `${rank.progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {fmtXp(rank.xpIntoRank)} / {rank.next ? fmtXp(rank.next.xpMin - rank.current.xpMin) : '—'} XP
          </p>
          <p className="text-xs text-gray-400">Total: <span className="font-semibold text-[#153b50]">{fmtXp(xpTotal)} XP</span></p>
        </div>
      </div>

      {/* Streak + Conquistas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${streak > 0 ? 'bg-orange-100' : 'bg-gray-100'}`}>
            <MdWhatshot size={20} className={streak > 0 ? 'text-orange-500' : 'text-gray-300'} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#153b50] leading-none">{streak}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f5f5f5] flex items-center justify-center shrink-0">
            <MdEmojiEvents size={20} className="text-[#153b50]" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#153b50] leading-none">{achievements.length}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">de {ALL_ACHIEVEMENTS.length} conquistas</p>
          </div>
        </div>
      </div>

      {/* Gráficos — side by side em telas maiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Minutos / semana</p>
          <ChartContainer config={minutesChartConfig} className="h-[130px] w-full">
            <BarChart data={minutesChartData} margin={{ left: -24, right: 4 }}>
              <CartesianGrid vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 9, fill: '#9CA3AF' }} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">XP acumulado</p>
          <ChartContainer config={xpChartConfig} className="h-[130px] w-full">
            <AreaChart data={xpChartData} margin={{ left: -24, right: 4 }}>
              <CartesianGrid vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 9, fill: '#9CA3AF' }} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="xp" type="monotone" stroke="var(--color-xp)" fill="#f5f5f5" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartContainer>
          {xpChartData.length > 0 && xpChartData[xpChartData.length - 1].xp > 0 && (
            <p className="text-[10px] font-semibold text-[#153b50] text-right mt-1">
              {fmtXp(xpChartData[xpChartData.length - 1].xp)} XP acumulado
            </p>
          )}
        </div>
      </div>

      {/* Stats semanais — acessos e itens */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MdAccessTime size={15} className="text-[#b2f0fb] shrink-0" />
            <p className="text-xs font-semibold text-gray-500">Acessos esta semana</p>
          </div>
          <p className="text-2xl font-bold text-[#153b50] leading-none">
            {weekStats.activeDays}
            <span className="text-sm font-normal text-gray-400 ml-1">
              / {weekStats.plannedDays || '—'} dias
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{weekStats.sessions} {weekStats.sessions === 1 ? 'sessão' : 'sessões'} de estudo</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MdCheckCircle size={15} className="text-[#b2f0fb] shrink-0" />
            <p className="text-xs font-semibold text-gray-500">Itens desta semana</p>
          </div>
          <p className="text-2xl font-bold text-[#153b50] leading-none">
            {weekStats.doneItems}
            <span className="text-sm font-normal text-gray-400 ml-1">
              / {weekStats.totalItems}
            </span>
          </p>
          {weekStats.totalItems > 0 && (
            <>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[#b2f0fb] rounded-full"
                  style={{ width: `${Math.round((weekStats.doneItems / weekStats.totalItems) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{pendingItems} pendente{pendingItems !== 1 ? 's' : ''}</p>
            </>
          )}
          {weekStats.totalItems === 0 && (
            <p className="text-xs text-gray-400 mt-1">Sem plano esta semana</p>
          )}
        </div>
      </div>

      {/* Atributos musicais */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Atributos musicais</p>
        <div className="space-y-2.5">
          {attrValues.map(({ key, xp }) => (
            <div key={key} className="flex items-center gap-3">
              <p className="text-xs text-gray-500 w-28 shrink-0">{ATTRIBUTE_LABEL[key]}</p>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.round((xp / maxAttr) * 100)}%`,
                    backgroundColor: xp > 0 ? '#b2f0fb' : 'transparent',
                    minWidth: xp > 0 ? '4px' : '0',
                  }}
                />
              </div>
              <p className="text-xs font-semibold text-gray-600 w-10 text-right shrink-0">{fmtXp(xp)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Conquistas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Conquistas
          <span className="text-xs font-normal text-gray-400 ml-2">{achievements.length}/{ALL_ACHIEVEMENTS.length}</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ALL_ACHIEVEMENTS.map(a => {
            const unlocked = unlockedSet.has(a.key)
            return (
              <div
                key={a.key}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition ${
                  unlocked
                    ? 'bg-green-50 border-green-100 text-green-700'
                    : 'bg-gray-50 border-gray-100 text-gray-300'
                }`}
              >
                {unlocked ? (
                  <AchievementIcon category={a.category} size={20} />
                ) : (
                  <MdLock size={18} />
                )}
                <p className="text-[10px] font-medium text-center leading-tight line-clamp-2">{a.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sessões recentes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Sessões recentes</p>
        {sessionsLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Nenhuma sessão registrada ainda.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">
                    Sessão de estudo — {s.cycle_name}
                    <span className="font-normal text-gray-400 ml-1">· {fmtDuration(s.duration_seconds)}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(s.started_at)}</p>
                  {s.notes && (
                    <p className="text-[11px] text-gray-400 mt-1 italic truncate">"{s.notes}"</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.xp > 0 && (
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-[#b2f0fb] bg-[#f5f5f5] px-1.5 py-0.5 rounded-full">
                      <MdStar size={11} />
                      +{s.xp} XP
                    </span>
                  )}
                  {s.difficulty_felt && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${difficultyColor[s.difficulty_felt]}`}>
                      {difficultyLabel[s.difficulty_felt]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
