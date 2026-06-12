import { useState, useEffect, useRef } from 'react'
import Avatar from 'boring-avatars'
import {
  MdEmojiEvents, MdPeople, MdCalendarToday, MdPlayCircle, MdCheckCircle,
  MdWhatshot, MdLock, MdArrowForward, MdClose, MdStar, MdPersonAdd,
  MdMusicNote, MdAutorenew, MdLeaderboard, MdBolt, MdGroup, MdGroups,
  MdCalendarMonth,
} from 'react-icons/md'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Area, AreaChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Spinner } from '@/components/ui/Spinner'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { useTeacherProgress } from '@/hooks/useTeacherProgress'
import { TEACHER_ACHIEVEMENT_KEYS } from '@/lib/teacherXpHelpers'
import { fireBasic, fireSideCannons } from '@/lib/confettiEffects'

import { AVATAR_COLORS } from '@/lib/colors'
const ONBOARDING_KEY = 'estudamus_jornada_prof_intro_seen'

// ─── Dados estáticos de conquistas ───────────────────────────────────────────

const ALL_ACHIEVEMENTS = [
  { key: TEACHER_ACHIEVEMENT_KEYS.PRIMEIRO_ALUNO,          label: 'Primeiro Aluno',          Icon: MdPersonAdd },
  { key: TEACHER_ACHIEVEMENT_KEYS.TURMA_3,                 label: 'Turma Pequena',            Icon: MdPeople },
  { key: TEACHER_ACHIEVEMENT_KEYS.TURMA_5,                 label: 'Turma em Crescimento',     Icon: MdGroup },
  { key: TEACHER_ACHIEVEMENT_KEYS.TURMA_10,                label: 'Turma Grande',             Icon: MdGroups },
  { key: TEACHER_ACHIEVEMENT_KEYS.PRIMEIRO_PLANO,          label: 'Primeiro Plano',           Icon: MdCalendarToday },
  { key: TEACHER_ACHIEVEMENT_KEYS.PLANEJADOR,              label: 'Planejador',               Icon: MdCalendarMonth },
  { key: TEACHER_ACHIEVEMENT_KEYS.PLANEJADOR_DEDICADO,     label: 'Planejador Dedicado',      Icon: MdAutorenew },
  { key: TEACHER_ACHIEVEMENT_KEYS.PRIMEIRA_PECA,           label: 'Primeira Peça',            Icon: MdMusicNote },
  { key: TEACHER_ACHIEVEMENT_KEYS.PRIMEIRO_RECITAL,        label: 'Primeiro Recital',         Icon: MdEmojiEvents },
  { key: TEACHER_ACHIEVEMENT_KEYS.ALUNO_RANK_ESTUDANTE,    label: 'Aluno Dedicado',           Icon: MdLeaderboard },
  { key: TEACHER_ACHIEVEMENT_KEYS.ALUNO_RANK_PROFISSIONAL, label: 'Aluno Profissional',       Icon: MdStar },
  { key: TEACHER_ACHIEVEMENT_KEYS.ALUNO_MESTRE,            label: 'Aluno Mestre',             Icon: MdStar },
  { key: TEACHER_ACHIEVEMENT_KEYS.STREAK_4_SEMANAS,        label: '4 Semanas Seguidas',       Icon: MdWhatshot },
  { key: TEACHER_ACHIEVEMENT_KEYS.TURMA_ATIVA,             label: 'Turma Ativa',              Icon: MdBolt },
]

// ─── Onboarding ───────────────────────────────────────────────────────────────

const STEPS = [
  {
    Icon: MdEmojiEvents,
    title: 'Bem-vindo à sua Jornada!',
    body: 'Acompanhe seu impacto como professor. Cada aluno adicionado, plano criado e sessão de estudo dos seus alunos gera XP para você.',
    extra: null,
  },
  {
    Icon: MdCalendarToday,
    title: 'Como ganhar XP',
    body: 'Suas ações pedagógicas têm peso direto na sua evolução.',
    extra: [
      { label: 'Adicionar aluno', xp: '+50 XP' },
      { label: 'Criar planejamento', xp: '+30 XP' },
      { label: 'Criar programa', xp: '+25 XP' },
      { label: 'Sessão do aluno', xp: '+3 XP' },
    ],
  },
  {
    Icon: MdPeople,
    title: 'Missões da Turma',
    body: 'Três missões semanais renovam toda segunda-feira: criar planos, engajar alunos e acompanhar conclusões. Complete todas para bônus de XP.',
    extra: null,
  },
  {
    Icon: MdLeaderboard,
    title: 'Ranks e Conquistas',
    body: 'Evolua de Aspirante até Grande Maestro. Desbloqueie conquistas especiais ao atingir marcos como turma ativa, aluno mestre e 4 semanas seguidas.',
    extra: null,
  },
] as const

function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const { Icon, title, body, extra } = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex justify-end px-4 pt-4">
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition">
            <MdClose size={20} />
          </button>
        </div>
        <div className="px-6 pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-[#f4d1ae] flex items-center justify-center">
              <Icon size={28} className="text-[#153b50]" />
            </div>
          </div>
          <h2 className="text-base font-bold text-[#153b50] text-center mb-2">{title}</h2>
          <p className="text-sm text-gray-500 text-center leading-relaxed">{body}</p>
          {extra && (
            <div className="mt-4 space-y-2">
              {extra.map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[#F8F6F5]">
                  <span className="text-xs text-gray-600">{item.label}</span>
                  <span className="text-xs font-bold text-[#b2f0fb]">{item.xp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 pt-4 pb-6 space-y-4">
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-5 bg-[#153b50]' : 'w-1.5 bg-gray-200'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-gray-300 transition">
              Pular
            </button>
            <button
              onClick={() => isLast ? onClose() : setStep(s => s + 1)}
              className="flex-1 py-2.5 rounded-xl bg-[#153b50] text-white text-sm font-semibold hover:bg-[#153b50]/90 transition flex items-center justify-center gap-1.5"
            >
              {isLast ? 'Entendi!' : 'Próximo'}
              {!isLast && <MdArrowForward size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtXp(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n)
}

function fmtMin(m: number) {
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60), r = m % 60
  return r === 0 ? `${h}h` : `${h}h${r}min`
}

function fmtWeek(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

const plansChartConfig: ChartConfig = { plans: { label: 'Planos', color: '#b2f0fb' } }
const xpChartConfig: ChartConfig = { xp: { label: 'XP', color: '#153b50' } }

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TeacherJourneyPage() {
  const { progress, loading } = useTeacherProgress()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const missionsAllDoneRef = useRef(false)

  useEffect(() => {
    if (!loading && progress?.teacherId) {
      const seen = localStorage.getItem(ONBOARDING_KEY)
      if (!seen) setShowOnboarding(true)
    }
  }, [loading, progress?.teacherId])

  const completedMissionCount = progress?.weeklyMissions?.filter(m => m.completed).length ?? 0
  const totalMissions = progress?.weeklyMissions?.length ?? 0

  useEffect(() => {
    if (totalMissions === 0) return
    const allDone = completedMissionCount === totalMissions
    if (allDone && !missionsAllDoneRef.current) fireSideCannons()
    missionsAllDoneRef.current = allDone
  }, [completedMissionCount, totalMissions])

  function closeOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
    fireBasic()
  }

  if (loading) {
    return <TeacherLayout><div className="flex justify-center py-12"><Spinner /></div></TeacherLayout>
  }

  if (!progress?.teacherId) {
    return (
      <TeacherLayout>
        <div className="flex flex-col items-center py-16 text-center px-4">
          <MdEmojiEvents size={48} className="text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-600">Jornada não disponível</p>
        </div>
      </TeacherLayout>
    )
  }

  const { rank, weekStreak, achievements, weeklyMissions, classStats, topStudents, xpHistory, plansHistory } = progress
  const unlockedSet = new Set(achievements)

  const xpData = xpHistory.map(h => ({ week: fmtWeek(h.week), xp: h.xp }))
  const plansData = plansHistory.map(h => ({ week: fmtWeek(h.week), plans: h.plans }))

  return (
    <TeacherLayout>
      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}

      {/* Título */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#153b50]">Jornada do Professor</h1>
        <p className="text-xs text-gray-400 mt-0.5">Acompanhe seu impacto pedagógico</p>
      </div>

      {/* Card de rank */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank atual</p>
          <p className="text-lg font-bold text-[#153b50] mt-0.5">{rank.current.label}</p>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#b2f0fb] rounded-full transition-all duration-700"
            style={{ width: `${rank.progressPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">
          {fmtXp(rank.xpIntoRank)} / {rank.next ? fmtXp(rank.next.xpMin - rank.current.xpMin) : '—'} XP
          {rank.next && <span className="ml-2 text-gray-300">· próximo: {rank.next.label}</span>}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f4d1ae] flex items-center justify-center shrink-0">
            <MdPeople size={18} className="text-[#153b50]" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#153b50] leading-none">{classStats.activeStudents}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">alunos ativos</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f4d1ae] flex items-center justify-center shrink-0">
            <MdCalendarToday size={18} className="text-[#153b50]" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#153b50] leading-none">{classStats.plansCreatedThisWeek}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">planos esta semana</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${classStats.studentsWithSessions > 0 ? 'bg-green-100' : 'bg-gray-100'}`}>
            <MdPlayCircle size={18} className={classStats.studentsWithSessions > 0 ? 'text-green-500' : 'text-gray-300'} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#153b50] leading-none">{classStats.studentsWithSessions}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">estudando esta semana</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${classStats.itemsDoneThisWeek > 0 ? 'bg-[#f4d1ae]' : 'bg-gray-100'}`}>
            <MdCheckCircle size={18} className={classStats.itemsDoneThisWeek > 0 ? 'text-[#b2f0fb]' : 'text-gray-300'} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#153b50] leading-none">{classStats.itemsDoneThisWeek}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">
              {classStats.totalItemsThisWeek > 0 ? `de ${classStats.totalItemsThisWeek} itens` : 'itens concluídos'}
            </p>
          </div>
        </div>
      </div>

      {/* Missões semanais */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Missões desta semana</p>
        <div className="space-y-3">
          {weeklyMissions.map(m => (
            <div key={m.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {m.completed ? (
                    <div className="w-4 h-4 rounded-full bg-[#153b50] flex items-center justify-center shrink-0">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                  )}
                  <p className={`text-xs truncate ${m.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {m.label}
                  </p>
                </div>
                <span className={`text-xs shrink-0 ml-2 ${m.completed ? 'text-gray-300' : 'text-[#b2f0fb] font-semibold'}`}>
                  +{m.xpReward} XP
                </span>
              </div>
              {!m.completed && (
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden ml-6" style={{ width: 'calc(100% - 1.5rem)' }}>
                  <div className="h-full bg-[#f4d1ae] rounded-full" style={{ width: `${Math.round(m.progress * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {topStudents.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Alunos desta semana</p>
          <div className="space-y-2">
            {topStudents.map((s, i) => (
              <div key={s.studentId} className="flex items-center gap-3">
                <span className={`text-xs font-bold w-5 shrink-0 text-center ${
                  i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'
                }`}>{i + 1}º</span>
                <div className="rounded-full overflow-hidden shrink-0">
                  <Avatar size={28} name={s.name} variant="beam" colors={AVATAR_COLORS} />
                </div>
                <p className="text-xs font-medium text-gray-700 flex-1 truncate">{s.name}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {s.minutesThisWeek > 0 && (
                    <span className="text-xs text-gray-400">{fmtMin(s.minutesThisWeek)}</span>
                  )}
                  {s.xpThisWeek > 0 && (
                    <span className="text-xs font-semibold text-[#b2f0fb] bg-[#f4d1ae]/50 px-1.5 py-0.5 rounded-lg">
                      +{s.xpThisWeek} XP
                    </span>
                  )}
                  {s.xpThisWeek === 0 && s.minutesThisWeek === 0 && (
                    <span className="text-xs text-gray-300">sem atividade</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Planos por semana</p>
          <ChartContainer config={plansChartConfig} className="h-[120px] w-full">
            <BarChart data={plansData} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="plans" fill="#b2f0fb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">XP acumulado</p>
          <ChartContainer config={xpChartConfig} className="h-[120px] w-full">
            <AreaChart data={xpData} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="xp" stroke="#153b50" strokeWidth={2} fill="#f4d1ae" />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      {/* Streak de semanas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${weekStreak > 0 ? 'bg-orange-100' : 'bg-gray-100'}`}>
          <MdWhatshot size={22} className={weekStreak > 0 ? 'text-orange-500' : 'text-gray-300'} />
        </div>
        <div>
          <p className="text-lg font-bold text-[#153b50] leading-none">{weekStreak}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {weekStreak === 1 ? 'semana seguida criando planos' : 'semanas seguidas criando planos'}
          </p>
        </div>
      </div>

      {/* Conquistas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Conquistas
          <span className="text-xs font-normal text-gray-400 ml-2">
            {achievements.length}/{ALL_ACHIEVEMENTS.length}
          </span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ALL_ACHIEVEMENTS.map(a => {
            const unlocked = unlockedSet.has(a.key)
            const Icon = a.Icon
            return (
              <div
                key={a.key}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition ${
                  unlocked
                    ? 'bg-[#f4d1ae]/40 border-[#f4d1ae] text-[#153b50]'
                    : 'bg-gray-50 border-gray-100 text-gray-300'
                }`}
              >
                {unlocked ? <Icon size={20} /> : <MdLock size={18} />}
                <p className="text-[10px] font-medium text-center leading-tight line-clamp-2">{a.label}</p>
              </div>
            )
          })}
        </div>
      </div>

    </TeacherLayout>
  )
}
