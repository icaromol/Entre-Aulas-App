import { useState, useEffect, useRef } from 'react'
import { useStudentProgress } from '@/hooks/useStudentProgress'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import {
  MdLock, MdStar, MdEmojiEvents, MdMusicNote, MdTimer, MdWhatshot,
  MdClose, MdArrowForward, MdStars, MdBolt, MdLeaderboard, MdTune, MdFlag,
} from 'react-icons/md'
import type { XpAttribute } from '@/lib/xpHelpers'
import { fireBasic, fireSideCannons } from '@/lib/confettiEffects'

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

// ─── Onboarding steps ─────────────────────────────────────────────────────────

const ONBOARDING_KEY = 'estudamus_jornada_intro_seen'

const STEPS = [
  {
    Icon: MdStars,
    title: 'Bem-vindo à Jornada Musical',
    body: 'Aqui você acompanha seu crescimento como músico de forma visual e gamificada. Cada hora de estudo conta — e o app transforma isso em progresso real.',
    extra: null,
  },
  {
    Icon: MdBolt,
    title: 'Como ganhar XP',
    body: 'XP é a moeda do seu progresso. Você ganha pontos ao completar atividades de estudo:',
    extra: [
      { label: 'Marcar uma tarefa',        xp: '+15 XP' },
      { label: 'Sessão de estudo',         xp: '+5 XP'  },
      { label: 'Concluir uma peça',        xp: '+300 XP'},
      { label: 'Missão do dia completa',   xp: '+20 XP' },
      { label: 'Missões semanais',         xp: 'até +75 XP'},
    ],
  },
  {
    Icon: MdLeaderboard,
    title: 'Ranks e Progressão',
    body: 'Você começa como Aprendiz IV e pode chegar ao Mestre. São 22 níveis que refletem sua dedicação ao longo do tempo. Cada região tem 4 sub-níveis: IV, III, II e I.',
    extra: null,
  },
  {
    Icon: MdTune,
    title: 'Atributos Musicais',
    body: 'Seu XP é distribuído entre 9 atributos: Técnica, Ritmo, Musicalidade, Percepção e mais. Cada tipo de atividade fortalece atributos diferentes — conforme o que você pratica.',
    extra: null,
  },
  {
    Icon: MdFlag,
    title: 'Missões e Conquistas',
    body: 'Complete missões diárias e semanais para ganhar XP extra. Desbloqueie conquistas especiais ao atingir marcos na sua jornada — como streak de 7 dias ou concluir 5 peças.',
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

        {/* Topo com botão fechar */}
        <div className="flex justify-end px-4 pt-4">
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition">
            <MdClose size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-6 pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-[#D6E4F0] flex items-center justify-center">
              <Icon size={28} className="text-[#1E3A5F]" />
            </div>
          </div>

          <h2 className="text-base font-bold text-[#1E3A5F] text-center mb-2">{title}</h2>
          <p className="text-sm text-gray-500 text-center leading-relaxed">{body}</p>

          {extra && (
            <div className="mt-4 space-y-2">
              {extra.map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[#F5F7FA]">
                  <span className="text-xs text-gray-600">{item.label}</span>
                  <span className="text-xs font-bold text-[#4A90C4]">{item.xp}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dots + botões */}
        <div className="px-6 pt-4 pb-6 space-y-4">
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-5 bg-[#1E3A5F]' : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-gray-300 transition"
            >
              Pular
            </button>
            <button
              onClick={() => isLast ? onClose() : setStep(s => s + 1)}
              className="flex-1 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition flex items-center justify-center gap-1.5"
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

function AchievementIcon({ category, size = 16 }: { category: string; size?: number }) {
  if (category === 'streak') return <MdWhatshot size={size} />
  if (category === 'piece')  return <MdMusicNote size={size} />
  if (category === 'session') return <MdTimer size={size} />
  if (category === 'rank')   return <MdEmojiEvents size={size} />
  return <MdStar size={size} />
}

function fmtXp(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n)
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const { progress, loading } = useStudentProgress()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const missionsAllDoneRef = useRef(false)

  useEffect(() => {
    if (!loading && progress?.studentId) {
      const seen = localStorage.getItem(ONBOARDING_KEY)
      if (!seen) setShowOnboarding(true)
    }
  }, [loading, progress?.studentId])

  const completedMissionCount = progress?.weeklyMissions?.filter(m => m.completed).length ?? 0
  const totalMissions = progress?.weeklyMissions?.length ?? 0

  useEffect(() => {
    if (totalMissions === 0) return
    const allDone = completedMissionCount === totalMissions
    if (allDone && !missionsAllDoneRef.current) {
      fireSideCannons()
    }
    missionsAllDoneRef.current = allDone
  }, [completedMissionCount, totalMissions])

  function closeOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
    fireBasic()
  }

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex justify-center py-12"><Spinner /></div>
      </StudentLayout>
    )
  }

  if (!progress?.studentId) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center py-16 text-center px-4">
          <MdEmojiEvents size={48} className="text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-600">Jornada não iniciada</p>
          <p className="text-xs text-gray-400 mt-1">Seu professor precisa criar um plano de estudos para você.</p>
        </div>
      </StudentLayout>
    )
  }

  const { rank, xpByAttribute, streak, activeMissions, todayMission, nextEvent, weeklyMissions, achievements } = progress
  const unlockedSet = new Set(achievements)

  const attrValues = ATTRIBUTE_ORDER.map(k => ({ key: k, xp: xpByAttribute[k] ?? 0 }))
  const maxAttr = Math.max(1, ...attrValues.map(a => a.xp))

  return (
    <StudentLayout>

      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}

      {/* Título da página */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1E3A5F]">Jornada Musical</h1>
        <p className="text-xs text-gray-400 mt-0.5">Acompanhe seu crescimento como músico</p>
      </div>

      {/* Card de rank */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank atual</p>
          <p className="text-lg font-bold text-[#1E3A5F] mt-0.5">{rank.current.display}</p>
        </div>

        {/* Barra de progresso */}
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#4A90C4] rounded-full transition-all duration-700"
            style={{ width: `${rank.progressPct}%` }}
          />
        </div>

        <p className="text-xs text-gray-400">
          {fmtXp(rank.xpIntoRank)} / {rank.next ? fmtXp(rank.next.xpMin - rank.current.xpMin) : '—'} XP
        </p>
      </div>

      {/* Streak + Próximo evento */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            streak > 0 ? 'bg-orange-100' : 'bg-gray-100'
          }`}>
            <MdWhatshot size={20} className={streak > 0 ? 'text-orange-500' : 'text-gray-300'} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#1E3A5F] leading-none">{streak}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">
              {streak === 1 ? 'dia seguido' : 'dias seguidos'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            nextEvent ? 'bg-[#D6E4F0]' : 'bg-gray-100'
          }`}>
            <MdStar size={20} className={nextEvent ? 'text-[#1E3A5F]' : 'text-gray-300'} />
          </div>
          <div className="min-w-0">
            {nextEvent ? (
              <>
                <p className="text-sm font-bold text-[#1E3A5F] leading-tight truncate">{nextEvent.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {nextEvent.daysUntil === 0 ? 'Hoje!' : `em ${nextEvent.daysUntil}d`}
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-400 leading-snug">Nenhum evento próximo</p>
            )}
          </div>
        </div>
      </div>

      {/* Missão do dia */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Missão do dia</p>
          {todayMission.completed ? (
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Completa</span>
          ) : (
            <span className="text-xs text-gray-400">+{todayMission.xpReward} XP</span>
          )}
        </div>

        {todayMission.total === 0 ? (
          <p className="text-xs text-gray-400">Nenhum item planejado para hoje.</p>
        ) : (
          <>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  todayMission.completed ? 'bg-green-400' : 'bg-[#4A90C4]'
                }`}
                style={{ width: `${Math.round((todayMission.done / todayMission.total) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {todayMission.done} de {todayMission.total} itens concluídos com pomodoro
            </p>
          </>
        )}
      </div>

      {/* Missões ativas */}
      {activeMissions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Missões ativas</p>
          <div className="space-y-3">
            {activeMissions.slice(0, 5).map(m => (
              <div key={m.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <MdMusicNote size={13} className="text-[#4A90C4] shrink-0" />
                    <p className="text-xs font-medium text-gray-700 truncate">{m.title}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">{m.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4A90C4] rounded-full"
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missões semanais */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Esta semana</p>
        <div className="space-y-3">
          {weeklyMissions.map(m => (
            <div key={m.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {m.completed ? (
                    <div className="w-4 h-4 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                  )}
                  <p className={`text-xs truncate ${m.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {m.label}
                  </p>
                </div>
                <span className={`text-xs shrink-0 ml-2 ${m.completed ? 'text-gray-300' : 'text-[#4A90C4] font-semibold'}`}>
                  +{m.xpReward} XP
                </span>
              </div>
              {!m.completed && (
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden ml-6" style={{ width: 'calc(100% - 1.5rem)' }}>
                  <div
                    className="h-full bg-[#D6E4F0] rounded-full"
                    style={{ width: `${Math.round(m.progress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Atributos musicais */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
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
              <p className="text-xs text-gray-400 w-10 text-right shrink-0">{fmtXp(xp)}</p>
            </div>
          ))}
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
            return (
              <div
                key={a.key}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition ${
                  unlocked
                    ? 'bg-[#D6E4F0]/40 border-[#D6E4F0] text-[#1E3A5F]'
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

    </StudentLayout>
  )
}
