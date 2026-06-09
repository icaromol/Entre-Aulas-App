import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'
import { grantXp } from '@/lib/xpHelpers'
import { formatWeekStart, getMonday } from '@/lib/weekUtils'
import { fireBasic, fireSideCannons, fireStars, hasRankUp } from '@/lib/confettiEffects'
import { sound } from '@/lib/soundEffects'

interface CyclePreset {
  key: string
  name: string
  workMinutes: number
  breakMinutes: number
  totalCycles: number
}

function autoPreset(durationMinutes: number): CyclePreset {
  if (durationMinutes <= 15) {
    return { key: 'auto', name: 'Automático', workMinutes: Math.max(5, durationMinutes), breakMinutes: 3, totalCycles: 1 }
  }
  if (durationMinutes <= 30) {
    return { key: 'auto', name: 'Automático', workMinutes: durationMinutes, breakMinutes: 5, totalCycles: 1 }
  }
  if (durationMinutes <= 50) {
    return { key: 'auto', name: 'Automático', workMinutes: Math.round(durationMinutes / 2), breakMinutes: 5, totalCycles: 2 }
  }
  if (durationMinutes <= 80) {
    return { key: 'auto', name: 'Automático', workMinutes: Math.round(durationMinutes / 3), breakMinutes: 5, totalCycles: 3 }
  }
  const cycles = Math.max(4, Math.round(durationMinutes / 25))
  return { key: 'auto', name: 'Automático', workMinutes: 25, breakMinutes: 5, totalCycles: cycles }
}

type Phase = 'idle' | 'work' | 'break' | 'finished'

interface DayItem {
  id: string
  kind: 'checklist'
  title: string
  subtitle: string
}

const ACHIEVEMENT_LABEL: Record<string, string> = {
  first_session:        'Primeira sessão concluída',
  first_piece:          'Primeira peça concluída',
  streak_3:             '3 dias seguidos',
  streak_7:             '7 dias seguidos',
  streak_14:            '14 dias seguidos',
  streak_30:            '30 dias seguidos',
  rank_estudante_4:     'Novo rank: Estudante!',
  rank_amador_4:        'Novo rank: Amador!',
  rank_junior_4:        'Novo rank: Júnior!',
  rank_profissional_4:  'Novo rank: Profissional!',
  rank_expert:          'Novo rank: Expert!',
  rank_mestre:          'Rank máximo: Mestre!',
  first_recital:        'Primeiro recital',
  pieces_3:             '3 peças concluídas',
  pieces_5:             '5 peças concluídas',
}

const CIRCUMFERENCE = 2 * Math.PI * 54

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

function fmtStudied(secs: number): string {
  if (secs < 60) return `${secs}s de estudo`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m} min ${s}s de estudo` : `${m} min de estudo`
}

export default function PomodoroPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const nav = location.state as {
    planItemId?: string; title?: string; durationMinutes?: number; studentId?: string; autoStart?: boolean
  } | null

  // ── Custom config ──
  const [customWork,   setCustomWork]   = useState(25)
  const [customBreak,  setCustomBreak]  = useState(5)
  const [customCycles, setCustomCycles] = useState(4)

  // ── Timer ──
  const [phase, setPhase]               = useState<Phase>('idle')
  const [currentCycle, setCurrentCycle] = useState(1)
  const [completedCycles, setCompletedCycles] = useState(0)
  const [isPaused, setIsPaused]         = useState(false)
  const [timeLeft, setTimeLeft]         = useState(0)
  const [totalSecs, setTotalSecs]       = useState(0)
  const [showEarlyDialog, setShowEarlyDialog] = useState(false)
  const activeCycle = useRef<CyclePreset | null>(null)
  const startedAt   = useRef<string | null>(null)
  const workSecs    = useRef(0)

  // ── Finish screen ──
  const [dayItems, setDayItems]         = useState<DayItem[]>([])
  const [workedIds, setWorkedIds]       = useState<Set<string>>(new Set())
  const [difficulty, setDifficulty]     = useState<'easy' | 'ok' | 'hard' | ''>('')
  const [comment, setComment]           = useState('')
  const [saving, setSaving]             = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)

  // ── Auto-start ──
  useEffect(() => {
    if (!nav?.autoStart && !nav?.planItemId) return
    const preset = nav?.planItemId
      ? autoPreset(nav.durationMinutes ?? 25)
      : { key: 'classic', name: 'Clássico', workMinutes: 20, breakMinutes: 5, totalCycles: 1 } as CyclePreset
    activeCycle.current = preset
    startedAt.current = new Date().toISOString()
    workSecs.current = 0
    const secs = preset.workMinutes * 60
    setCurrentCycle(1)
    setCompletedCycles(0)
    setPhase('work')
    setTimeLeft(secs)
    setTotalSecs(secs)
    setIsPaused(false)
  }, [])

  // ── Timer tick ──
  useEffect(() => {
    if ((phase !== 'work' && phase !== 'break') || isPaused) return
    const id = setInterval(() => {
      if (phase === 'work') workSecs.current += 1
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [phase, isPaused])

  // ── Phase transitions ──
  useEffect(() => {
    if (timeLeft !== 0) return
    if (phase !== 'work' && phase !== 'break') return
    const c = activeCycle.current
    if (!c) return

    if (phase === 'work') {
      const newCompleted = completedCycles + 1
      setCompletedCycles(newCompleted)

      if (currentCycle < c.totalCycles) {
        // Há mais ciclos — vai para pausa
        sound.pomodoroSection()
        const secs = c.breakMinutes * 60
        setPhase('break')
        setTimeLeft(secs)
        setTotalSecs(secs)
      } else {
        // Todos os ciclos completos — pré-marca o item da sessão
        sound.pomodoroSuccess()
        setPhase('finished')
        openFinishModal(true)
      }
    } else {
      // Pausa acabou — próximo ciclo de trabalho
      const next = currentCycle + 1
      setCurrentCycle(next)
      const secs = c.workMinutes * 60
      setPhase('work')
      setTimeLeft(secs)
      setTotalSecs(secs)
      setIsPaused(false)
    }
  }, [timeLeft, phase, currentCycle, completedCycles])

  // ── Start ──
  function startSession(preset?: CyclePreset) {
    const c = preset ?? {
      key: 'custom', name: 'Personalizado',
      workMinutes: customWork, breakMinutes: customBreak, totalCycles: customCycles,
    }
    activeCycle.current = c
    startedAt.current = new Date().toISOString()
    workSecs.current = 0
    const secs = c.workMinutes * 60
    setCurrentCycle(1)
    setCompletedCycles(0)
    setPhase('work')
    setTimeLeft(secs)
    setTotalSecs(secs)
    setIsPaused(false)
    setShowEarlyDialog(false)
  }

  // ── End early ──
  function handleEndEarly() {
    if (completedCycles === 0) {
      setIsPaused(true)
      setShowEarlyDialog(true)
    } else {
      setPhase('finished')
      openFinishModal(false)
    }
  }

  // ── Fetch items for finish screen ──
  async function openFinishModal(_allCyclesDone: boolean) {
    setLoadingItems(true)
    const sid = nav?.studentId
    if (!sid) { setLoadingItems(false); return }

    const [completionsRes, piecesRes, exercisesRes] = await Promise.all([
      supabase.from('checklist_completions').select('checklist_item_id').eq('student_id', sid),
      supabase.from('pieces')
        .select('id, title, checklist_items(id, title)')
        .eq('student_id', sid).eq('status', 'in_progress'),
      supabase.from('exercises')
        .select('id, title, checklist_items(id, title)')
        .eq('student_id', sid).eq('status', 'active'),
    ])

    if (completionsRes.error || piecesRes.error || exercisesRes.error) {
      console.error('[PomodoroPage] fetch failed:', completionsRes.error ?? piecesRes.error ?? exercisesRes.error)
      setLoadingItems(false)
      return
    }

    const completedIds = new Set(
      (completionsRes.data ?? []).map((c: any) => c.checklist_item_id)
    )

    const items: DayItem[] = []

    for (const piece of (piecesRes.data ?? []) as any[]) {
      for (const ci of (piece.checklist_items ?? []) as any[]) {
        if (!completedIds.has(ci.id))
          items.push({ id: ci.id, kind: 'checklist', title: ci.title, subtitle: piece.title })
      }
    }
    for (const ex of (exercisesRes.data ?? []) as any[]) {
      for (const ci of (ex.checklist_items ?? []) as any[]) {
        if (!completedIds.has(ci.id))
          items.push({ id: ci.id, kind: 'checklist', title: ci.title, subtitle: ex.title })
      }
    }

    setDayItems(items)
    setLoadingItems(false)
  }

  // ── Save ──
  async function saveSession() {
    setSaving(true)
    const sid = nav?.studentId
    const c = activeCycle.current
    if (!sid || !c) { setSaving(false); navigate('/aluno/hoje'); return }

    const endedAt = new Date().toISOString()

    const { data: sessionData, error } = await supabase
      .from('study_sessions')
      .insert({
        student_id: sid,
        cycle_name: c.name,
        cycle_work_minutes: c.workMinutes,
        cycle_break_minutes: c.breakMinutes,
        cycle_total: c.totalCycles,
        started_at: startedAt.current,
        ended_at: endedAt,
        duration_seconds: workSecs.current,
        difficulty_felt: difficulty || null,
        notes: comment || null,
      })
      .select('id')
      .single()

    if (error) {
      if (import.meta.env.DEV) console.error('[pomodoro] save error', error.code)
    } else if (sessionData?.id) {
      const { newAchievements } = await grantXp(sid, 'pomodoro_session', sessionData.id, null)
      sound.xpEarn()
      toast.success('+5 XP · Sessão concluída!')
      for (const key of newAchievements) {
        toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`)
      }
      if (hasRankUp(newAchievements)) fireStars()
      else fireBasic()
    }

    const checklistIds = [...workedIds]

    if (checklistIds.length > 0) {
      await supabase.from('checklist_completions').insert(
        checklistIds.map(id => ({ checklist_item_id: id, student_id: sid }))
      )

      // Verificar se alguma peça chegou a 100%
      const { data: ciRows } = await supabase
        .from('checklist_items')
        .select('piece_id')
        .in('id', checklistIds)
        .not('piece_id', 'is', null)

      const pieceIds = [...new Set((ciRows ?? []).map((r: { piece_id: string }) => r.piece_id))]

      if (pieceIds.length > 0) {
        const [piecesRes, alreadyGrantedRes] = await Promise.all([
          supabase.from('pieces').select('id, completion_pct').in('id', pieceIds),
          supabase.from('student_xp_events')
            .select('source_id')
            .eq('student_id', sid)
            .eq('reason', 'piece_completed')
            .in('source_id', pieceIds),
        ])

        const alreadyGranted = new Set((alreadyGrantedRes.data ?? []).map(r => r.source_id))

        for (const piece of (piecesRes.data ?? [])) {
          if (piece.completion_pct === 100 && !alreadyGranted.has(piece.id)) {
            const { newAchievements: pAch } = await grantXp(sid, 'piece_completed', piece.id, 'musicalidade')
            toast.success('+300 XP · Peça concluída! 🎼')
            for (const key of pAch) {
              toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`)
            }
            if (hasRankUp(pAch)) fireStars()
            fireSideCannons()
          }
        }
      }
    }

    // Inserir session_items ligando a sessão aos plan_items trabalhados
    if (sessionData?.id) {
      const planItemIds = new Set<string>()
      if (nav?.planItemId) planItemIds.add(nav.planItemId)

      if (checklistIds.length > 0) {
        const weekStart = formatWeekStart(getMonday(new Date()))
        const { data: plan } = await supabase
          .from('weekly_plans').select('id')
          .eq('student_id', sid).eq('week_start', weekStart).maybeSingle()
        if (plan?.id) {
          const { data: matched } = await supabase
            .from('plan_items').select('id')
            .eq('plan_id', plan.id).in('checklist_item_id', checklistIds)
          for (const pi of matched ?? []) planItemIds.add(pi.id)
        }
      }

      if (planItemIds.size > 0) {
        await supabase.from('session_items').insert(
          [...planItemIds].map(planItemId => ({ session_id: sessionData.id, plan_item_id: planItemId }))
        )
      }
    }

    toast.success('Sessão registrada!')
    navigate('/aluno/hoje')
  }

  // ── Derived ──
  const progress   = totalSecs > 0 ? timeLeft / totalSecs : 0
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const c          = activeCycle.current
  const isWork     = phase === 'work'

  // ─────────────────────────────────────────────────────
  // IDLE
  // ─────────────────────────────────────────────────────
  if (phase === 'idle' && (nav?.autoStart || nav?.planItemId)) {
    return <StudentLayout><p className="text-sm text-gray-400 mt-8 text-center">Iniciando...</p></StudentLayout>
  }

  if (phase === 'idle') {
    return (
      <StudentLayout>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[#1E3A5F] flex-1">Pomodoro</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          {[
            { label: 'Minutos de estudo', value: customWork,   set: setCustomWork,   min: 1, max: 120 },
            { label: 'Minutos de pausa',  value: customBreak,  set: setCustomBreak,  min: 1, max: 60  },
            { label: 'Número de ciclos',  value: customCycles, set: setCustomCycles, min: 1, max: 10  },
          ].map(f => (
            <div key={f.label} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{f.label}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => f.set((v: number) => Math.max(f.min, v - 1))}
                  className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#4A90C4] transition">−</button>
                <span className="w-8 text-center text-sm font-semibold text-[#1E3A5F]">{f.value}</span>
                <button onClick={() => f.set((v: number) => Math.min(f.max, v + 1))}
                  className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#4A90C4] transition">+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <Button onClick={() => navigate(-1)} variant="outline" className="flex-1 h-12 rounded-2xl text-sm border-gray-200">
            Voltar
          </Button>
          <Button
            onClick={() => startSession()}
            disabled={customWork < 1 || customBreak < 1 || customCycles < 1}
            className="flex-1 h-12 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-2xl text-sm font-semibold"
          >
            Iniciar sessão
          </Button>
        </div>
      </StudentLayout>
    )
  }

  // ─────────────────────────────────────────────────────
  // WORK / BREAK
  // ─────────────────────────────────────────────────────
  if (phase === 'work' || phase === 'break') {
    return (
      <StudentLayout>
        {/* Dialog de encerramento antecipado */}
        {showEarlyDialog && (
          <div className="fixed inset-0 bg-black/40 z-20 flex items-end justify-center pb-8 px-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
              <p className="text-sm font-bold text-gray-800 mb-1">Encerrar sessão?</p>
              <p className="text-xs text-gray-400 mb-4">
                Você ainda não completou nenhum ciclo. Deseja salvar a sessão mesmo assim?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowEarlyDialog(false); setIsPaused(false) }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition"
                >
                  Continuar
                </button>
                <button
                  onClick={() => navigate('/aluno/hoje')}
                  className="flex-1 py-2.5 rounded-xl border border-red-200 text-sm text-red-500 hover:bg-red-50 transition"
                >
                  Descartar
                </button>
                <button
                  onClick={() => { setShowEarlyDialog(false); setPhase('finished'); openFinishModal(false) }}
                  className="flex-1 py-2.5 rounded-xl bg-[#1E3A5F] text-sm text-white font-medium hover:bg-[#1E3A5F]/90 transition"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-2">
          <h1 className="text-base font-bold text-[#1E3A5F]">Pomodoro</h1>
          {nav?.title && <p className="text-xs text-gray-400 mt-0.5">{nav.title}</p>}
        </div>

        {/* Cronômetro */}
        <div className="flex flex-col items-center py-4">
          <div className={`text-xs font-semibold mb-4 px-3 py-1 rounded-full ${
            isWork ? 'bg-[#D6E4F0] text-[#1E3A5F]' : 'bg-green-100 text-green-600'
          }`}>
            {isWork ? `Ciclo ${currentCycle} de ${c?.totalCycles}` : 'Pausa'}
          </div>

          <div className="relative w-[80vw] max-w-xs aspect-square">
            <svg viewBox="0 0 120 120" className="-rotate-90 w-full h-full">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#F3F4F6" strokeWidth="6"/>
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={isWork ? '#1E3A5F' : '#4ADE80'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-[#1E3A5F] tabular-nums">{fmt(timeLeft)}</span>
              <span className="text-sm text-gray-400 mt-2">
                {isWork
                  ? completedCycles > 0
                    ? `${completedCycles * (c?.workMinutes ?? 0)} min concluídos`
                    : 'em andamento'
                  : 'pausa'}
              </span>
            </div>
          </div>

          {/* Dots de ciclos */}
          {c && c.totalCycles > 1 && (
            <div className="flex gap-2 mt-5">
              {Array.from({ length: c.totalCycles }).map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full transition ${
                  i < completedCycles              ? 'bg-[#1E3A5F]'
                  : i === currentCycle - 1 && isWork ? 'bg-[#4A90C4]'
                  : 'bg-gray-200'
                }`}/>
              ))}
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-3 mt-2">
          <Button
            onClick={() => setIsPaused(p => !p)}
            variant="outline"
            className="flex-1 h-12 rounded-2xl text-sm font-semibold border-gray-200"
          >
            {isPaused ? 'Retomar' : 'Pausar'}
          </Button>
          <Button
            onClick={handleEndEarly}
            variant="outline"
            className="flex-1 h-12 rounded-2xl text-sm font-semibold text-red-500 border-red-200 hover:bg-red-50"
          >
            Encerrar sessão
          </Button>
        </div>
      </StudentLayout>
    )
  }

  // ─────────────────────────────────────────────────────
  // FINISHED
  // ─────────────────────────────────────────────────────
  return (
    <StudentLayout>
      <div className="flex flex-col items-center pt-4 pb-6">
        <p className="text-4xl mb-2">🎉</p>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Sessão encerrada!</h1>
        <p className="text-sm text-gray-400 mt-1">{fmtStudied(workSecs.current)}</p>
      </div>

      {/* O que você trabalhou */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">O que você trabalhou?</p>
        {loadingItems ? (
          <Spinner size={16} />
        ) : dayItems.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">Nenhum item pendente. Tudo em dia! 🎉</p>
        ) : (
          <div className="space-y-2">
            {dayItems.map(item => {
              const checked = workedIds.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => setWorkedIds(prev => {
                    const next = new Set(prev)
                    checked ? next.delete(item.id) : next.add(item.id)
                    return next
                  })}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                    checked ? 'bg-[#1E3A5F] border-[#1E3A5F]' : 'border-gray-300'
                  }`}>
                    {checked && (
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.title}</p>
                    <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Como foi */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">Como foi a sessão?</p>
        <div className="flex gap-2">
          {([
            { key: 'easy', label: 'Fácil',   emoji: '😊' },
            { key: 'ok',   label: 'Ok',       emoji: '😐' },
            { key: 'hard', label: 'Difícil',  emoji: '😓' },
          ] as const).map(d => (
            <button
              key={d.key}
              onClick={() => setDifficulty(d.key)}
              className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border transition ${
                difficulty === d.key
                  ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-[#4A90C4]'
              }`}
            >
              <span className="text-xl">{d.emoji}</span>
              <span className="text-xs font-medium mt-1">{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Comentários */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
        <p className="text-sm font-semibold text-gray-600 mb-2">
          Comentários <span className="font-normal text-gray-400">(opcional)</span>
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Dificuldades, dúvidas, observações..."
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none"
        />
      </div>

      {/* Botões */}
      <div className="flex gap-3">
        <Button
          onClick={() => navigate('/aluno/hoje')}
          variant="outline"
          className="flex-1 h-12 rounded-2xl text-sm text-red-500 border-red-200 hover:bg-red-50"
        >
          Excluir e voltar
        </Button>
        <Button
          onClick={saveSession}
          disabled={saving}
          className="flex-1 h-12 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-2xl text-sm font-semibold"
        >
          {saving ? 'Salvando...' : 'Salvar sessão'}
        </Button>
      </div>
    </StudentLayout>
  )
}
