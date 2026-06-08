import { useStudentProgress } from '@/hooks/useStudentProgress'
import { Spinner } from '@/components/ui/Spinner'
import {
  MdWhatshot, MdEmojiEvents, MdLock, MdStar,
  MdMusicNote, MdTimer, MdAccessTime, MdCheckCircle,
} from 'react-icons/md'
import type { XpAttribute } from '@/lib/xpHelpers'

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

// ─── Gráfico de barras responsivo (SVG) ──────────────────────────────────────

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const CHART_H = 56
  const maxVal = Math.max(1, ...data.map(d => d.value))
  const barW   = 20
  const gap    = 6
  const totalW = data.length * (barW + gap) - gap
  const viewH  = CHART_H + 24

  return (
    <svg
      viewBox={`0 0 ${totalW} ${viewH}`}
      width="100%"
      style={{ display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {data.map((d, i) => {
        const h   = Math.max(d.value > 0 ? 3 : 0, Math.round((d.value / maxVal) * CHART_H))
        const x   = i * (barW + gap)
        const y   = CHART_H - h
        const isMax = d.value === maxVal && d.value > 0
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={color} />
            {isMax && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="#6B7280">
                {d.value}
              </text>
            )}
            <text x={x + barW / 2} y={CHART_H + 13} textAnchor="middle" fontSize={8} fill="#9CA3AF">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Gráfico de área responsivo (SVG) ─────────────────────────────────────────

function AreaChart({ data }: { data: { label: string; value: number }[] }) {
  const CHART_H = 56
  const CHART_W = 200
  const maxVal  = Math.max(1, ...data.map(d => d.value))
  const n       = data.length

  const points = data.map((d, i) => ({
    x: Math.round((i / (n - 1)) * CHART_W),
    y: Math.round(CHART_H - (d.value / maxVal) * CHART_H),
  }))

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')
  const polygon  = `0,${CHART_H} ${polyline} ${CHART_W},${CHART_H}`
  const lastPt   = points[points.length - 1]
  const lastVal  = data[data.length - 1].value

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H + 16}`}
      width="100%"
      style={{ display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon points={polygon} fill="#D6E4F0" />
      <polyline points={polyline} fill="none" stroke="#1E3A5F" strokeWidth={2} strokeLinejoin="round" />
      {lastVal > 0 && (
        <text x={lastPt.x} y={Math.max(10, lastPt.y - 4)} textAnchor="end" fontSize={8} fill="#1E3A5F" fontWeight="600">
          {fmtXp(lastVal)} XP
        </text>
      )}
    </svg>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  studentId: string
}

export function StudentJornadaTab({ studentId }: Props) {
  const { progress, loading } = useStudentProgress({ studentId })

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
    value: h.minutes,
  }))

  const xpChartData = xpHistory.map(h => ({
    label: shortWeekLabel(h.week),
    value: h.xp,
  }))

  const pendingItems = weekStats.totalItems - weekStats.doneItems

  return (
    <div className="space-y-4 pb-4">

      {/* Rank + XP */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank atual</p>
          <p className="text-lg font-bold text-[#1E3A5F] mt-0.5">{rank.current.display}</p>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#4A90C4] rounded-full transition-all duration-700"
            style={{ width: `${rank.progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {fmtXp(rank.xpIntoRank)} / {rank.next ? fmtXp(rank.next.xpMin - rank.current.xpMin) : '—'} XP
          </p>
          <p className="text-xs text-gray-400">Total: <span className="font-semibold text-[#1E3A5F]">{fmtXp(xpTotal)} XP</span></p>
        </div>
      </div>

      {/* Streak + Conquistas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${streak > 0 ? 'bg-orange-100' : 'bg-gray-100'}`}>
            <MdWhatshot size={20} className={streak > 0 ? 'text-orange-500' : 'text-gray-300'} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#1E3A5F] leading-none">{streak}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#D6E4F0] flex items-center justify-center shrink-0">
            <MdEmojiEvents size={20} className="text-[#1E3A5F]" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#1E3A5F] leading-none">{achievements.length}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">de {ALL_ACHIEVEMENTS.length} conquistas</p>
          </div>
        </div>
      </div>

      {/* Gráficos — side by side em telas maiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Minutos / semana</p>
          <BarChart data={minutesChartData} color="#4A90C4" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">XP acumulado</p>
          <AreaChart data={xpChartData} />
        </div>
      </div>

      {/* Stats semanais — acessos e itens */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MdAccessTime size={15} className="text-[#4A90C4] shrink-0" />
            <p className="text-xs font-semibold text-gray-500">Acessos esta semana</p>
          </div>
          <p className="text-2xl font-bold text-[#1E3A5F] leading-none">
            {weekStats.activeDays}
            <span className="text-sm font-normal text-gray-400 ml-1">
              / {weekStats.plannedDays || '—'} dias
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{weekStats.sessions} {weekStats.sessions === 1 ? 'sessão' : 'sessões'} de estudo</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MdCheckCircle size={15} className="text-[#4A90C4] shrink-0" />
            <p className="text-xs font-semibold text-gray-500">Itens desta semana</p>
          </div>
          <p className="text-2xl font-bold text-[#1E3A5F] leading-none">
            {weekStats.doneItems}
            <span className="text-sm font-normal text-gray-400 ml-1">
              / {weekStats.totalItems}
            </span>
          </p>
          {weekStats.totalItems > 0 && (
            <>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[#4A90C4] rounded-full"
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
                    backgroundColor: xp > 0 ? '#4A90C4' : 'transparent',
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

    </div>
  )
}
