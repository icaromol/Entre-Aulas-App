import { useAuth } from '@/hooks/useAuth'
import { useStudentProgress } from '@/hooks/useStudentProgress'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { MdLock, MdStar, MdEmojiEvents, MdMusicNote, MdTimer, MdWhatshot } from 'react-icons/md'
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
  if (category === 'streak') return <MdWhatshot size={size} />
  if (category === 'piece')  return <MdMusicNote size={size} />
  if (category === 'session') return <MdTimer size={size} />
  if (category === 'rank')   return <MdEmojiEvents size={size} />
  return <MdStar size={size} />
}

function greeting(name: string) {
  const h = new Date().getHours()
  const part = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${part}, ${name}`
}

function fmtXp(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n)
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const { profile } = useAuth()
  const { progress, loading } = useStudentProgress()

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

  const { rank, xpTotal, xpByAttribute, streak, activeMissions, todayMission, nextEvent, weeklyMissions, achievements } = progress
  const unlockedSet = new Set(achievements)
  const firstName = profile?.first_name ?? ''

  // Atributos — ordenados, normalizados pelo maior valor
  const attrValues = ATTRIBUTE_ORDER.map(k => ({ key: k, xp: xpByAttribute[k] ?? 0 }))
  const maxAttr = Math.max(1, ...attrValues.map(a => a.xp))

  return (
    <StudentLayout>

      {/* Saudação */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1E3A5F]">{greeting(firstName)}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{rank.current.display} · {fmtXp(xpTotal)} XP</p>
      </div>

      {/* Card de rank */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank atual</p>
            <p className="text-lg font-bold text-[#1E3A5F] mt-0.5">{rank.current.display}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#D6E4F0] flex items-center justify-center">
            <MdEmojiEvents size={22} className="text-[#1E3A5F]" />
          </div>
        </div>

        {/* Barra de progresso */}
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
          {rank.next ? (
            <p className="text-xs text-gray-400">
              Próximo: <span className="font-semibold text-[#1E3A5F]">{rank.next.display}</span>
              {rank.xpNeeded > 0 && <span> · faltam {fmtXp(rank.xpNeeded)} XP</span>}
            </p>
          ) : (
            <p className="text-xs font-semibold text-[#4A90C4]">Rank máximo</p>
          )}
        </div>
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
              {todayMission.done} de {todayMission.total} itens concluídos
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
