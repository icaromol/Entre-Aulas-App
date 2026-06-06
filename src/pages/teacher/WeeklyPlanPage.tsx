import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdArrowBack, MdChevronLeft, MdChevronRight,
  MdMusicNote, MdFitnessCenter, MdAccessTime, MdClose, MdSave, MdAdd,
} from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'
import type { PlanItem } from '@/types/plan'
import {
  getMonday,
  formatWeekStart,
  addWeeks,
  formatWeekLabel,
  getDayLabel,
  getDayFullLabel,
  getDayDate,
} from '@/lib/weekUtils'

interface Availability {
  day_of_week: number
  is_active: boolean
  minutes_available: number | null
}

interface RepertoireItem {
  id: string
  type: 'piece' | 'exercise'
  title: string
  subtitle: string
}

// ─── Item do dia ───
function DayPlanItem({
  item,
  onRemove,
  onDurationChange,
}: {
  item: PlanItem
  onRemove: (id: string) => void
  onDurationChange: (id: string, minutes: number) => void
}) {
  const dur = item.duration_minutes ?? 15
  const title = item.piece?.title ?? item.exercise?.title ?? '—'
  const subtitle = item.piece
    ? `${item.piece.completion_pct}% concluída`
    : item.exercise?.category ?? ''

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
      <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
        item.piece_id ? 'bg-[#D6E4F0] text-[#1E3A5F]' : 'bg-purple-100 text-purple-600'
      }`}>
        {item.piece_id ? <MdMusicNote size={12} /> : <MdFitnessCenter size={12} />}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700 truncate">{title}</p>
        <p className="text-[10px] text-gray-400 truncate">{subtitle}</p>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => onDurationChange(item.id, Math.max(5, dur - 5))}
          className="w-5 h-5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-xs font-bold transition"
        >−</button>
        <span className="text-xs font-semibold text-gray-700 w-7 text-center">{dur}</span>
        <button
          onClick={() => onDurationChange(item.id, Math.min(120, dur + 5))}
          className="w-5 h-5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-xs font-bold transition"
        >+</button>
        <MdAccessTime size={11} className="text-gray-300 ml-1" />
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="text-gray-300 hover:text-red-400 transition shrink-0"
      >
        <MdClose size={14} />
      </button>
    </div>
  )
}

// ─── Coluna de um dia ───
function DayColumn({
  day,
  date,
  items,
  availability,
  onRemove,
  onDurationChange,
  onOpenPicker,
}: {
  day: number
  date: string
  items: PlanItem[]
  availability: Availability | undefined
  onRemove: (id: string) => void
  onDurationChange: (id: string, minutes: number) => void
  onOpenPicker: () => void
}) {
  const totalMinutes = items.reduce((sum, i) => sum + (i.duration_minutes ?? 0), 0)
  const availableMinutes = availability?.minutes_available ?? 0
  const isOvertime = totalMinutes > availableMinutes && availableMinutes > 0
  const isActive = availability?.is_active ?? false

  return (
    <div className={`shrink-0 w-[260px] snap-start rounded-2xl p-3 min-h-36 ${isActive ? 'bg-gray-50' : 'bg-gray-50/50'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-bold ${isActive ? 'text-gray-700' : 'text-gray-300'}`}>
            {getDayLabel(day)}
          </p>
          <p className={`text-[10px] mt-0.5 ${isActive ? 'text-gray-400' : 'text-gray-300'}`}>{date}</p>
          {isActive && availableMinutes > 0 && (
            <p className={`text-[10px] font-medium mt-0.5 ${isOvertime ? 'text-red-400' : 'text-gray-400'}`}>
              {totalMinutes}/{availableMinutes} min
            </p>
          )}
          {isActive && availableMinutes === 0 && (
            <p className="text-[10px] text-gray-400 mt-0.5">sem duração</p>
          )}
          {!isActive && (
            <p className="text-[10px] text-gray-300 mt-0.5">indisponível</p>
          )}
        </div>
        {isActive && (
          <button
            onClick={onOpenPicker}
            className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#4A90C4] hover:text-[#4A90C4] transition shrink-0"
          >
            <MdAdd size={14} />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {items.map(item => (
          <DayPlanItem
            key={item.id}
            item={item}
            onRemove={onRemove}
            onDurationChange={onDurationChange}
          />
        ))}
      </div>

      {isActive && items.length === 0 && (
        <p className="text-[10px] text-gray-300 text-center mt-4">Nenhum item</p>
      )}
    </div>
  )
}

// ─── Página principal ───
export default function WeeklyPlanPage() {
  const { studentId } = useParams()
  const { profile } = useAuth()

  const [weekStart, setWeekStart] = useState(() => formatWeekStart(getMonday(new Date())))
  const [planId, setPlanId] = useState<string | null>(null)
  const [planItems, setPlanItems] = useState<PlanItem[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [repertoire, setRepertoire] = useState<RepertoireItem[]>([])
  const [studentName, setStudentName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Picker state
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (studentId && profile) fetchAll()
  }, [studentId, profile, weekStart])

  async function fetchAll() {
    setLoading(true)

    const [studentRes, availRes, piecesRes, exercisesRes] = await Promise.all([
      supabase.from('students').select('first_name, last_name').eq('id', studentId!).single(),
      supabase.from('student_availability').select('*').eq('student_id', studentId!),
      supabase.from('pieces').select('id, title, composer, completion_pct').eq('student_id', studentId!).eq('status', 'in_progress'),
      supabase.from('exercises').select('id, title, category').eq('student_id', studentId!).eq('status', 'active'),
    ])

    setStudentName(`${studentRes.data?.first_name} ${studentRes.data?.last_name}`)
    setAvailability(availRes.data ?? [])

    const rep: RepertoireItem[] = [
      ...(piecesRes.data ?? []).map((p: { id: string; title: string; composer: string | null; completion_pct: number }) => ({
        id: p.id,
        type: 'piece' as const,
        title: p.title,
        subtitle: p.composer ? `${p.composer} · ${p.completion_pct}%` : `${p.completion_pct}%`,
      })),
      ...(exercisesRes.data ?? []).map((e: { id: string; title: string; category: string }) => ({
        id: e.id,
        type: 'exercise' as const,
        title: e.title,
        subtitle: e.category,
      })),
    ]
    setRepertoire(rep)
    await fetchOrCreatePlan()
    setLoading(false)
  }

  async function fetchOrCreatePlan() {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()

    if (!teacher) return

    let { data: plan } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('student_id', studentId!)
      .eq('week_start', weekStart)
      .single()

    if (!plan) {
      const { data: newPlan } = await supabase
        .from('weekly_plans')
        .insert({ student_id: studentId!, teacher_id: teacher.id, week_start: weekStart })
        .select('id')
        .single()
      plan = newPlan
    }

    if (!plan) return
    setPlanId(plan.id)

    const { data: items } = await supabase
      .from('plan_items')
      .select(`*, piece:pieces(title, composer, completion_pct), exercise:exercises(title, category)`)
      .eq('plan_id', plan.id)
      .order('position')

    setPlanItems((items ?? []).map((item: PlanItem) => ({
      ...item,
      piece: item.piece ?? undefined,
      exercise: item.exercise ?? undefined,
    })))
  }

  async function copyFromLastWeek() {
    if (!planId) return
    const lastWeek = formatWeekStart(addWeeks(new Date(weekStart + 'T00:00:00'), -1))

    const { data: lastPlan } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('student_id', studentId!)
      .eq('week_start', lastWeek)
      .single()

    if (!lastPlan) { alert('Nenhum plano encontrado na semana anterior.'); return }

    const { data: lastItems } = await supabase
      .from('plan_items')
      .select('*')
      .eq('plan_id', lastPlan.id)
      .order('position')

    if (!lastItems || lastItems.length === 0) { alert('O plano da semana anterior está vazio.'); return }

    await supabase.from('plan_items').delete().eq('plan_id', planId)
    await supabase.from('plan_items').insert(
      lastItems.map((item: PlanItem) => ({
        plan_id: planId,
        day_of_week: item.day_of_week,
        piece_id: item.piece_id,
        exercise_id: item.exercise_id,
        duration_minutes: item.duration_minutes,
        position: item.position,
        notes: item.notes,
        is_done: false,
      }))
    )
    await fetchOrCreatePlan()
  }

  function closePicker() {
    setPickerDay(null)
    setPickerSelected(new Set())
  }

  function togglePickerItem(id: string) {
    setPickerSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (pickerSelected.size === repertoire.length) {
      setPickerSelected(new Set())
    } else {
      setPickerSelected(new Set(repertoire.map(r => r.id)))
    }
  }

  async function handleAddSelected() {
    if (!planId || pickerDay === null || pickerSelected.size === 0) return
    const day = pickerDay
    setAdding(true)
    closePicker()

    const dayItems = planItems.filter(i => i.day_of_week === day)
    const inserts = [...pickerSelected].map((rid, idx) => {
      const rep = repertoire.find(r => r.id === rid)!
      return {
        plan_id: planId,
        day_of_week: day,
        piece_id: rep.type === 'piece' ? rid : null,
        exercise_id: rep.type === 'exercise' ? rid : null,
        duration_minutes: 15,
        position: dayItems.length + idx,
        is_done: false,
      }
    })

    const { data: newItems } = await supabase
      .from('plan_items')
      .insert(inserts)
      .select('*, piece:pieces(title, composer, completion_pct), exercise:exercises(title, category)')

    if (newItems) {
      const avail = availability.find(a => a.day_of_week === day)
      const availMins = avail?.minutes_available ?? 0
      const all = [...dayItems, ...newItems]
      const perItem = availMins > 0
        ? Math.max(5, Math.round(availMins / all.length / 5) * 5)
        : 15

      setPlanItems(prev => [
        ...prev.filter(i => i.day_of_week !== day),
        ...all.map(i => ({
          ...i,
          duration_minutes: perItem,
          piece: i.piece ?? undefined,
          exercise: i.exercise ?? undefined,
        })),
      ])
    }

    setAdding(false)
  }

  async function handleRemove(itemId: string) {
    await supabase.from('plan_items').delete().eq('id', itemId)
    setPlanItems(prev => prev.filter(i => i.id !== itemId))
  }

  function handleDurationChange(itemId: string, minutes: number) {
    setPlanItems(prev =>
      prev.map(i => i.id === itemId ? { ...i, duration_minutes: minutes } : i)
    )
  }

  async function handleSave() {
    if (!planId) return
    setSaving(true)

    const updates = planItems.map((item, index) => ({
      id: item.id,
      plan_id: planId,
      day_of_week: item.day_of_week,
      piece_id: item.piece_id,
      exercise_id: item.exercise_id,
      duration_minutes: item.duration_minutes,
      position: index,
      notes: item.notes,
      is_done: item.is_done,
    }))

    await supabase.from('plan_items').delete().eq('plan_id', planId)
    if (updates.length > 0) await supabase.from('plan_items').insert(updates)

    setSaving(false)
    toast.success('Plano salvo!')
  }

  function changeWeek(delta: number) {
    setWeekStart(formatWeekStart(addWeeks(new Date(weekStart + 'T00:00:00'), delta)))
  }

  const hasActiveDays = availability.some(a => a.is_active)

  if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>

  return (
    <TeacherLayout>
      {/* Picker modal */}
      {pickerDay !== null && (
        <div className="fixed inset-0 bg-black/40 z-20 flex items-end justify-center" onClick={closePicker}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-md flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1E3A5F]">
                Adicionar — {getDayFullLabel(pickerDay)}
              </h2>
              <button onClick={closePicker} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            <div className="px-5 pt-3">
              <button
                onClick={toggleSelectAll}
                className="w-full py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:border-[#4A90C4] hover:text-[#4A90C4] transition"
              >
                {pickerSelected.size === repertoire.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {repertoire.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Nenhuma peça ou exercício ativo.
                </p>
              ) : (
                repertoire.map(r => (
                  <label
                    key={r.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 cursor-pointer hover:bg-[#D6E4F0]/30 transition"
                  >
                    <input
                      type="checkbox"
                      checked={pickerSelected.has(r.id)}
                      onChange={() => togglePickerItem(r.id)}
                      className="accent-[#1E3A5F] w-4 h-4 shrink-0"
                    />
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                      r.type === 'piece' ? 'bg-[#D6E4F0] text-[#1E3A5F]' : 'bg-purple-100 text-purple-600'
                    }`}>
                      {r.type === 'piece' ? <MdMusicNote size={13} /> : <MdFitnessCenter size={13} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                      <p className="text-xs text-gray-400">{r.subtitle}</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-gray-100">
              <Button
                onClick={handleAddSelected}
                disabled={pickerSelected.size === 0 || adding}
                className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white"
              >
                {adding ? 'Adicionando...' : `Adicionar ${pickerSelected.size > 0 ? pickerSelected.size : ''} ${pickerSelected.size === 1 ? 'item' : 'itens'}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link to={`/professor/alunos/${studentId}`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E3A5F]">Plano semanal</h1>
          <p className="text-xs text-gray-400 mt-0.5">{studentName}</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs"
        >
          <MdSave size={15} />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Seletor de tipo de plano */}
      <div className="flex gap-2 mb-5">
        <button className="px-4 py-2 rounded-xl bg-[#1E3A5F] text-white text-xs font-semibold">
          Plano semanal
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-300 cursor-not-allowed flex items-center gap-1.5"
        >
          Plano personalizado
          <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Em breve</span>
        </button>
      </div>

      {/* Navegação de semana */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-5">
        <button onClick={() => changeWeek(-1)} className="text-gray-400 hover:text-[#1E3A5F] transition">
          <MdChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#1E3A5F]">{formatWeekLabel(weekStart)}</p>
          <button
            onClick={copyFromLastWeek}
            className="text-[10px] text-[#4A90C4] hover:underline mt-0.5"
          >
            Copiar semana anterior
          </button>
        </div>
        <button onClick={() => changeWeek(1)} className="text-gray-400 hover:text-[#1E3A5F] transition">
          <MdChevronRight size={20} />
        </button>
      </div>

      {/* Dias em scroll horizontal */}
      {!hasActiveDays ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-sm text-gray-400">
            Este aluno não tem disponibilidade semanal configurada.
          </p>
          <Link to={`/professor/alunos/${studentId}/editar`}>
            <Button className="mt-4 bg-[#1E3A5F] text-white text-xs">
              Configurar disponibilidade
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory -mx-4 px-4">
            {[1, 2, 3, 4, 5, 6, 0].map(day => (
              <DayColumn
                key={day}
                day={day}
                date={getDayDate(weekStart, day)}
                items={planItems.filter(i => i.day_of_week === day)}
                availability={availability.find(a => a.day_of_week === day)}
                onRemove={handleRemove}
                onDurationChange={handleDurationChange}
                onOpenPicker={() => { setPickerDay(day); setPickerSelected(new Set()) }}
              />
            ))}
          </div>

        </>
      )}
    </TeacherLayout>
  )
}
