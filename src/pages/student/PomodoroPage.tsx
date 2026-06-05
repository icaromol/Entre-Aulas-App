import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'
import { getMonday, formatWeekStart, getTodayDayOfWeek } from '@/lib/weekUtils'

interface CyclePreset {
  key: string
  name: string
  emoji: string
  hint: string
  workMinutes: number
  shortBreakMinutes: number
  totalCycles: number
}

const PRESETS: CyclePreset[] = [
  { key: 'beginner', name: 'Iniciante',    emoji: '🌱', hint: '20 min · pausa 5 min · 3 ciclos',  workMinutes: 20, shortBreakMinutes: 5,  totalCycles: 3 },
  { key: 'classic',  name: 'Clássico',     emoji: '🍅', hint: '25 min · pausa 5 min · 4 ciclos',  workMinutes: 25, shortBreakMinutes: 5,  totalCycles: 4 },
  { key: 'focused',  name: 'Focado',       emoji: '🎯', hint: '50 min · pausa 10 min · 2 ciclos', workMinutes: 50, shortBreakMinutes: 10, totalCycles: 2 },
  { key: 'custom',   name: 'Personalizado', emoji: '⚙️', hint: 'Defina seu ritmo',               workMinutes: 0,  shortBreakMinutes: 0,  totalCycles: 0 },
]

type Phase = 'idle' | 'work' | 'break' | 'finished'

interface DayItem {
  id: string
  title: string
  subtitle: string
  is_done: boolean
}

const CIRCUMFERENCE = 2 * Math.PI * 54

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

export default function PomodoroPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const nav = location.state as {
    planItemId?: string; title?: string; durationMinutes?: number; studentId?: string
  } | null

  // ── Cycle selection ──
  const [selectedKey, setSelectedKey] = useState('classic')
  const [customWork, setCustomWork]   = useState(25)
  const [customBreak, setCustomBreak] = useState(5)
  const [customCycles, setCustomCycles] = useState(4)

  // ── Timer ──
  const [phase, setPhase]           = useState<Phase>('idle')
  const [currentCycle, setCurrentCycle] = useState(1)
  const [isPaused, setIsPaused]     = useState(false)
  const [timeLeft, setTimeLeft]     = useState(0)
  const [totalSecs, setTotalSecs]   = useState(0)
  const activeCycle = useRef<CyclePreset | null>(null)
  const startedAt   = useRef<string | null>(null)
  const workSecs    = useRef(0)

  // ── Finish modal ──
  const [dayItems, setDayItems]     = useState<DayItem[]>([])
  const [workedIds, setWorkedIds]   = useState<Set<string>>(new Set())
  const [difficulty, setDifficulty] = useState<'easy' | 'ok' | 'hard' | ''>('')
  const [comment, setComment]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)

  // ── Helpers ──
  function buildCycle(): CyclePreset {
    if (selectedKey === 'custom') {
      return { key: 'custom', name: 'Personalizado', emoji: '⚙️', hint: '',
        workMinutes: customWork, shortBreakMinutes: customBreak, totalCycles: customCycles }
    }
    return PRESETS.find(p => p.key === selectedKey)!
  }

  // ── Timer tick ──
  useEffect(() => {
    if ((phase !== 'work' && phase !== 'break') || isPaused) return
    const id = setInterval(() => {
      if (phase === 'work') workSecs.current += 1
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [phase, isPaused])

  // ── Phase transition when timeLeft reaches 0 ──
  useEffect(() => {
    if (timeLeft !== 0) return
    if (phase !== 'work' && phase !== 'break') return
    const c = activeCycle.current
    if (!c) return

    if (phase === 'work') {
      if (currentCycle < c.totalCycles) {
        const secs = c.shortBreakMinutes * 60
        setPhase('break')
        setTimeLeft(secs)
        setTotalSecs(secs)
      } else {
        setPhase('finished')
        openFinishModal()
      }
    } else {
      const next = currentCycle + 1
      setCurrentCycle(next)
      const secs = c.workMinutes * 60
      setPhase('work')
      setTimeLeft(secs)
      setTotalSecs(secs)
      setIsPaused(false)
    }
  }, [timeLeft, phase, currentCycle])

  // ── Actions ──
  function startSession() {
    const c = buildCycle()
    activeCycle.current = c
    startedAt.current = new Date().toISOString()
    workSecs.current = 0
    const secs = c.workMinutes * 60
    setCurrentCycle(1)
    setPhase('work')
    setTimeLeft(secs)
    setTotalSecs(secs)
    setIsPaused(false)
  }

  function endEarly() {
    setPhase('finished')
    openFinishModal()
  }

  async function openFinishModal() {
    setLoadingItems(true)
    const studentId = nav?.studentId
    if (!studentId) { setLoadingItems(false); return }

    const weekStart = formatWeekStart(getMonday(new Date()))
    const today = getTodayDayOfWeek()

    const { data: plan } = await supabase
      .from('weekly_plans').select('id')
      .eq('student_id', studentId).eq('week_start', weekStart).single()

    if (plan) {
      const { data: items } = await supabase
        .from('plan_items')
        .select(`id, is_done, piece:pieces(title, composer), exercise:exercises(title, category)`)
        .eq('plan_id', plan.id).eq('day_of_week', today).order('position')

      const mapped: DayItem[] = (items ?? []).map((i: any) => ({
        id: i.id,
        is_done: i.is_done,
        title: i.piece?.title ?? i.exercise?.title ?? '—',
        subtitle: i.piece ? (i.piece.composer ?? 'Peça') : (i.exercise?.category ?? 'Exercício'),
      }))
      setDayItems(mapped)

      // Pre-check the item that launched this session
      if (nav?.planItemId) {
        setWorkedIds(new Set([nav.planItemId]))
      }
    }
    setLoadingItems(false)
  }

  async function saveSession() {
    setSaving(true)
    const studentId = nav?.studentId
    const c = activeCycle.current
    if (!studentId || !c) { setSaving(false); navigate('/aluno/hoje'); return }

    const endedAt = new Date().toISOString()

    const { data: session } = await supabase
      .from('study_sessions')
      .insert({
        student_id: studentId,
        cycle_name: c.name,
        cycle_work_minutes: c.workMinutes,
        cycle_break_minutes: c.shortBreakMinutes,
        cycle_total: c.totalCycles,
        started_at: startedAt.current,
        ended_at: endedAt,
        duration_seconds: workSecs.current,
        difficulty_felt: difficulty || null,
        notes: comment || null,
      })
      .select('id').single()

    if (session && workedIds.size > 0) {
      const ids = Array.from(workedIds)

      await supabase.from('session_items').insert(
        ids.map(pid => ({ session_id: session.id, plan_item_id: pid }))
      )

      await supabase.from('plan_items')
        .update({ is_done: true, done_at: endedAt })
        .in('id', ids)
    }

    navigate('/aluno/hoje')
  }

  // ── Derived ──
  const progress   = totalSecs > 0 ? timeLeft / totalSecs : 0
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const preset     = PRESETS.find(p => p.key === selectedKey)!
  const isWork     = phase === 'work'
  const isBreak    = phase === 'break'
  const c          = activeCycle.current

  // ───────────────────────────────────────────────
  // IDLE — seleção de ciclo
  // ───────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <StudentLayout>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#1E3A5F]">Pomodoro</h1>
            {nav?.title && <p className="text-xs text-gray-400 mt-0.5 truncate">{nav.title}</p>}
          </div>
        </div>

        <p className="text-sm font-medium text-gray-600 mb-3">Escolha o modo de estudo</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setSelectedKey(p.key)}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedKey === p.key
                  ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                  : 'bg-white border-gray-100 text-gray-700 hover:border-[#4A90C4]'
              }`}
            >
              <p className="text-2xl mb-1">{p.emoji}</p>
              <p className="text-sm font-bold">{p.name}</p>
              <p className={`text-[11px] mt-0.5 ${selectedKey === p.key ? 'text-white/70' : 'text-gray-400'}`}>
                {p.hint}
              </p>
            </button>
          ))}
        </div>

        {selectedKey === 'custom' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500">Configurar ciclo</p>
            {[
              { label: 'Minutos de estudo', value: customWork, set: setCustomWork, min: 1, max: 120 },
              { label: 'Minutos de pausa', value: customBreak, set: setCustomBreak, min: 1, max: 60 },
              { label: 'Número de ciclos',  value: customCycles, set: setCustomCycles, min: 1, max: 10 },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{f.label}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => f.set(v => Math.max(f.min, v - 1))}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#4A90C4] transition">−</button>
                  <span className="w-8 text-center text-sm font-semibold text-[#1E3A5F]">{f.value}</span>
                  <button onClick={() => f.set(v => Math.min(f.max, v + 1))}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#4A90C4] transition">+</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={startSession}
          disabled={selectedKey === 'custom' && (customWork < 1 || customBreak < 1 || customCycles < 1)}
          className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white h-12 text-base font-semibold rounded-2xl"
        >
          Iniciar sessão
        </Button>
      </StudentLayout>
    )
  }

  // ───────────────────────────────────────────────
  // WORK / BREAK — cronômetro
  // ───────────────────────────────────────────────
  if (phase === 'work' || phase === 'break') {
    return (
      <StudentLayout>
        <div className="flex justify-end mb-4">
          <button onClick={endEarly}
            className="text-xs text-gray-400 hover:text-red-400 transition px-3 py-1 rounded-lg border border-gray-200 hover:border-red-200">
            Encerrar sessão
          </button>
        </div>

        {/* Cronômetro circular */}
        <div className="flex flex-col items-center py-6">
          <div className={`text-xs font-semibold mb-6 px-3 py-1 rounded-full ${
            isWork ? 'bg-[#D6E4F0] text-[#1E3A5F]' : 'bg-green-100 text-green-600'
          }`}>
            {isWork ? `Ciclo ${currentCycle} de ${c?.totalCycles}` : 'Pausa'}
          </div>

          <div className="relative">
            <svg width="160" height="160" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#F3F4F6" strokeWidth="8"/>
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={isWork ? '#1E3A5F' : '#4ADE80'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-[#1E3A5F] tabular-nums">{fmt(timeLeft)}</span>
              <span className="text-xs text-gray-400 mt-1">{isWork ? 'estudando' : 'pausa'}</span>
            </div>
          </div>

          {/* Dots de ciclos */}
          {c && (
            <div className="flex gap-2 mt-6">
              {Array.from({ length: c.totalCycles }).map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full transition ${
                  i < currentCycle - 1 ? 'bg-[#1E3A5F]'
                  : i === currentCycle - 1 && isWork ? 'bg-[#4A90C4]'
                  : 'bg-gray-200'
                }`}/>
              ))}
            </div>
          )}

          {nav?.title && (
            <p className="mt-4 text-sm text-gray-500 text-center px-4">{nav.title}</p>
          )}
        </div>

        {/* Controles */}
        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => setIsPaused(p => !p)}
            variant="outline"
            className="flex-1 h-12 rounded-2xl text-sm font-semibold border-gray-200"
          >
            {isPaused ? 'Retomar' : 'Pausar'}
          </Button>
        </div>
      </StudentLayout>
    )
  }

  // ───────────────────────────────────────────────
  // FINISHED — modal de encerramento
  // ───────────────────────────────────────────────
  return (
    <StudentLayout>
      <div className="flex flex-col items-center pt-4 pb-8">
        <p className="text-4xl mb-2">🎉</p>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Sessão encerrada!</h1>
        <p className="text-sm text-gray-400 mt-1">
          {Math.round(workSecs.current / 60)} min de estudo
        </p>
      </div>

      {/* O que você trabalhou */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">O que você trabalhou?</p>
        {loadingItems ? (
          <p className="text-xs text-gray-400">Carregando...</p>
        ) : dayItems.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhum item no plano de hoje.</p>
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
                    <p className="text-xs text-gray-400">{item.subtitle}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Dificuldade */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-600 mb-3">Como foi a sessão?</p>
        <div className="flex gap-2">
          {([
            { key: 'easy', label: 'Fácil', emoji: '😊' },
            { key: 'ok',   label: 'Ok',    emoji: '😐' },
            { key: 'hard', label: 'Difícil', emoji: '😓' },
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

      {/* Comentário */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
        <p className="text-sm font-semibold text-gray-600 mb-2">Comentários <span className="font-normal text-gray-400">(opcional)</span></p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Dificuldades, dúvidas, observações..."
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none"
        />
      </div>

      <Button
        onClick={saveSession}
        disabled={saving}
        className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white h-12 text-base font-semibold rounded-2xl"
      >
        {saving ? 'Salvando...' : 'Salvar sessão'}
      </Button>
    </StudentLayout>
  )
}
