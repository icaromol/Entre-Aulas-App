import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
import {
  MdAccessTime, MdWhatshot, MdCheckCircle, MdStar, MdHistory,
} from 'react-icons/md'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { useStudentProgress } from '@/hooks/useStudentProgress'
import { getMonday, formatWeekStart } from '@/lib/weekUtils'

function shortWeekLabel(isoMonday: string): string {
  const [, m, d] = isoMonday.split('-')
  return `${d}/${m}`
}

function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function fmtXp(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n)
}

const minutesConfig = {
  minutes: { label: 'Minutos', color: '#b2f0fb' },
} satisfies ChartConfig

const xpConfig = {
  xp: { label: 'XP', color: '#153b50' },
} satisfies ChartConfig

export default function StatsPage() {
  const navigate = useNavigate()
  const { progress, loading } = useStudentProgress()

  const currentWeekStart = formatWeekStart(getMonday(new Date()))

  const minutesData = useMemo(
    () => (progress?.minutesHistory ?? []).map(h => ({
      label: shortWeekLabel(h.week),
      minutes: h.minutes,
      isCurrent: h.week === currentWeekStart,
    })),
    [progress?.minutesHistory]
  )

  const xpData = useMemo(
    () => (progress?.xpHistory ?? []).map(h => ({
      label: shortWeekLabel(h.week),
      xp: h.xp,
    })),
    [progress?.xpHistory]
  )

  const thisWeekMinutes = minutesData.find(d => d.isCurrent)?.minutes ?? 0

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex justify-center py-16"><Spinner /></div>
      </StudentLayout>
    )
  }

  const { weekStats, streak, xpTotal } = progress ?? {
    weekStats: { sessions: 0, activeDays: 0, plannedDays: 0, doneItems: 0, totalItems: 0 },
    streak: 0,
    xpTotal: 0,
  }

  const itemsPct = weekStats.totalItems > 0
    ? Math.round((weekStats.doneItems / weekStats.totalItems) * 100)
    : 0

  return (
    <StudentLayout>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#153b50]">Estatísticas</h1>
        <p className="text-sm text-gray-400 mt-0.5">Seu progresso em números</p>
      </div>

      {/* Stat cards 2×2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <MdAccessTime size={16} className="text-[#b2f0fb]" />
            <p className="text-xs text-gray-400">Esta semana</p>
          </div>
          <p className="text-xl font-bold text-[#153b50] leading-none">{fmtMinutes(thisWeekMinutes)}</p>
          <p className="text-[11px] text-gray-400 mt-1">{weekStats.sessions} {weekStats.sessions === 1 ? 'sessão' : 'sessões'}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <MdWhatshot size={16} className={streak > 0 ? 'text-orange-400' : 'text-gray-300'} />
            <p className="text-xs text-gray-400">Sequência</p>
          </div>
          <p className="text-xl font-bold text-[#153b50] leading-none">{streak}</p>
          <p className="text-[11px] text-gray-400 mt-1">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <MdCheckCircle size={16} className="text-[#b2f0fb]" />
            <p className="text-xs text-gray-400">Itens semana</p>
          </div>
          <p className="text-xl font-bold text-[#153b50] leading-none">
            {weekStats.doneItems}
            <span className="text-sm font-normal text-gray-400 ml-1">/ {weekStats.totalItems}</span>
          </p>
          {weekStats.totalItems > 0 && (
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-[#b2f0fb] rounded-full" style={{ width: `${itemsPct}%` }} />
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <MdStar size={16} className="text-[#b2f0fb]" />
            <p className="text-xs text-gray-400">XP total</p>
          </div>
          <p className="text-xl font-bold text-[#153b50] leading-none">{fmtXp(xpTotal)}</p>
          <p className="text-[11px] text-gray-400 mt-1">pontos de experiência</p>
        </div>
      </div>

      {/* Gráfico: Minutos por semana */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-1">Minutos estudados</p>
        <p className="text-xs text-gray-400 mb-3">Últimas 8 semanas</p>
        <ChartContainer config={minutesConfig} className="h-[160px] w-full">
          <BarChart data={minutesData} margin={{ left: -24, right: 4 }}>
            <CartesianGrid vertical={false} stroke="#F3F4F6" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
            />
            <YAxis hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Gráfico: XP acumulado */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-1">XP acumulado</p>
        <p className="text-xs text-gray-400 mb-3">Últimas 8 semanas</p>
        <ChartContainer config={xpConfig} className="h-[160px] w-full">
          <AreaChart data={xpData} margin={{ left: -24, right: 4 }}>
            <CartesianGrid vertical={false} stroke="#F3F4F6" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
            />
            <YAxis hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="xp"
              type="monotone"
              stroke="var(--color-xp)"
              fill="#f4d1ae"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Link histórico */}
      <button
        onClick={() => navigate('/aluno/historico')}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-gray-200 text-sm font-medium text-[#b2f0fb] hover:bg-[#f4d1ae]/40 transition"
      >
        <MdHistory size={18} />
        Ver histórico de sessões
      </button>

    </StudentLayout>
  )
}
