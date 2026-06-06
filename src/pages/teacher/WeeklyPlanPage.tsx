import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

// ─── Componente de item draggable ───
function SortablePlanItem({
  item,
  onRemove,
  onDurationChange,
}: {
  item: PlanItem
  onRemove: (id: string) => void
  onDurationChange: (id: string, minutes: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const title = item.piece?.title ?? item.exercise?.title ?? '—'
  const subtitle = item.piece
    ? `${item.piece.completion_pct}% concluída`
    : item.exercise
    ? item.exercise.category
    : ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2 group"
    >
      {/* Handle */}
      <div
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </div>

      {/* Tipo badge */}
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
        item.piece_id
          ? 'bg-[#D6E4F0] text-[#1E3A5F]'
          : 'bg-purple-100 text-purple-600'
      }`}>
        {item.piece_id ? 'PEÇA' : 'EX'}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700 truncate">{title}</p>
        <p className="text-[10px] text-gray-400 truncate">{subtitle}</p>
      </div>

      {/* Duração */}
      <input
        type="number"
        value={item.duration_minutes ?? 15}
        onChange={e => onDurationChange(item.id, Number(e.target.value))}
        min={5}
        max={120}
        step={5}
        className="w-12 text-center text-xs border border-gray-200 rounded-lg py-1 outline-none focus:border-[#4A90C4] transition"
        title="minutos"
      />
      <span className="text-[10px] text-gray-400 shrink-0">min</span>

      {/* Remover */}
      <button
        onClick={() => onRemove(item.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition shrink-0"
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Componente de coluna do dia ───
function DayColumn({
  day,
  items,
  availability,
  onRemove,
  onDurationChange,
  onAddItem,
  repertoire,
}: {
  day: number
  items: PlanItem[]
  availability: Availability | undefined
  onRemove: (id: string) => void
  onDurationChange: (id: string, minutes: number) => void
  onAddItem: (day: number, item: RepertoireItem) => void
  repertoire: RepertoireItem[]
}) {
  const [showPicker, setShowPicker] = useState(false)
  const totalMinutes = items.reduce((sum, i) => sum + (i.duration_minutes ?? 0), 0)
  const availableMinutes = availability?.minutes_available ?? 0
  const isOvertime = totalMinutes > availableMinutes && availableMinutes > 0

  return (
    <div className="bg-gray-50 rounded-2xl p-3 min-h-32">
      {/* Header do dia */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-bold text-gray-600">{getDayFullLabel(day)}</p>
          {availability?.is_active ? (
            <p className={`text-[10px] font-medium ${isOvertime ? 'text-red-400' : 'text-gray-400'}`}>
              {totalMinutes}/{availableMinutes} min
            </p>
          ) : (
            <p className="text-[10px] text-gray-300">Sem disponibilidade</p>
          )}
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#4A90C4] hover:text-[#4A90C4] transition"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>

      {/* Lista sortable */}
      <SortableContext
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1.5 min-h-8">
          {items.map(item => (
            <SortablePlanItem
              key={item.id}
              item={item}
              onRemove={onRemove}
              onDurationChange={onDurationChange}
            />
          ))}
        </div>
      </SortableContext>

      {items.length === 0 && (
        <p className="text-[10px] text-gray-300 text-center mt-4">
          Arraste itens aqui
        </p>
      )}

      {/* Picker de itens */}
      {showPicker && (
        <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-2 max-h-48 overflow-y-auto">
          <p className="text-[10px] font-semibold text-gray-400 px-2 mb-1">Adicionar ao dia</p>
          {repertoire.length === 0 ? (
            <p className="text-xs text-gray-400 px-2 py-2">Nenhum item no repertório.</p>
          ) : (
            repertoire.map(r => (
              <button
                key={r.id}
                onClick={() => { onAddItem(day, r); setShowPicker(false) }}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition"
              >
                <p className="text-xs font-medium text-gray-700">{r.title}</p>
                <p className="text-[10px] text-gray-400">{r.subtitle}</p>
              </button>
            ))
          )}
          <button
            onClick={() => setShowPicker(false)}
            className="w-full text-center text-[10px] text-gray-400 py-1 mt-1 border-t border-gray-100"
          >
            Fechar
          </button>
        </div>
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
  const [activeDays, setActiveDays] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeItem, setActiveItem] = useState<PlanItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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

    const avail: Availability[] = availRes.data ?? []
    setAvailability(avail)
    setActiveDays(avail.filter(d => d.is_active).map(d => d.day_of_week).sort())

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

    // Busca ou cria o plano da semana
    await fetchOrCreatePlan(rep)
    setLoading(false)
  }

  async function fetchOrCreatePlan(rep: RepertoireItem[]) {
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
      .select(`
        *,
        piece:pieces(title, composer, completion_pct),
        exercise:exercises(title, category)
      `)
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

    if (!lastPlan) {
      alert('Nenhum plano encontrado na semana anterior.')
      return
    }

    const { data: lastItems } = await supabase
      .from('plan_items')
      .select('*')
      .eq('plan_id', lastPlan.id)
      .order('position')

    if (!lastItems || lastItems.length === 0) {
      alert('O plano da semana anterior está vazio.')
      return
    }

    // Remove itens atuais e copia
    await supabase.from('plan_items').delete().eq('plan_id', planId)

    const newItems = lastItems.map((item: PlanItem) => ({
      plan_id: planId,
      day_of_week: item.day_of_week,
      piece_id: item.piece_id,
      exercise_id: item.exercise_id,
      duration_minutes: item.duration_minutes,
      position: item.position,
      notes: item.notes,
      is_done: false,
    }))

    await supabase.from('plan_items').insert(newItems)
    await fetchOrCreatePlan(repertoire)
  }

  // ─── Drag handlers ───
  function handleDragStart(event: DragStartEvent) {
    const item = planItems.find(i => i.id === event.active.id)
    setActiveItem(item ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeItem = planItems.find(i => i.id === activeId)
    if (!activeItem) return

    // Se está sobre um dia (container)
    const overDay = parseInt(overId.replace('day-', ''))
    if (!isNaN(overDay) && activeItem.day_of_week !== overDay) {
      setPlanItems(prev =>
        prev.map(i => i.id === activeId ? { ...i, day_of_week: overDay } : i)
      )
      return
    }

    // Se está sobre outro item
    const overItem = planItems.find(i => i.id === overId)
    if (!overItem) return

    if (activeItem.day_of_week !== overItem.day_of_week) {
      setPlanItems(prev =>
        prev.map(i => i.id === activeId ? { ...i, day_of_week: overItem.day_of_week } : i)
      )
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeIdx = planItems.findIndex(i => i.id === activeId)
    const overIdx = planItems.findIndex(i => i.id === overId)

    if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
      const reordered = arrayMove(planItems, activeIdx, overIdx)
      setPlanItems(reordered)
    }
  }

  // ─── Adicionar item ───
  async function handleAddItem(day: number, repertoireItem: RepertoireItem) {
    if (!planId) return

    const dayItems = planItems.filter(i => i.day_of_week === day)
    const position = dayItems.length

    const insertData = {
      plan_id: planId,
      day_of_week: day,
      piece_id: repertoireItem.type === 'piece' ? repertoireItem.id : null,
      exercise_id: repertoireItem.type === 'exercise' ? repertoireItem.id : null,
      duration_minutes: 15,
      position,
      is_done: false,
    }

    const { data } = await supabase
      .from('plan_items')
      .insert(insertData)
      .select(`*, piece:pieces(title, composer, completion_pct), exercise:exercises(title, category)`)
      .single()

    if (data) {
      setPlanItems(prev => [...prev, { ...data, piece: data.piece ?? undefined, exercise: data.exercise ?? undefined }])
    }
  }

  // ─── Remover item ───
  async function handleRemove(itemId: string) {
    await supabase.from('plan_items').delete().eq('id', itemId)
    setPlanItems(prev => prev.filter(i => i.id !== itemId))
  }

  // ─── Atualizar duração ───
  function handleDurationChange(itemId: string, minutes: number) {
    setPlanItems(prev =>
      prev.map(i => i.id === itemId ? { ...i, duration_minutes: minutes } : i)
    )
  }

  // ─── Salvar plano ───
  const handleSave = useCallback(async () => {
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
    if (updates.length > 0) {
      await supabase.from('plan_items').insert(updates)
    }

    setSaving(false)
    toast.success('Plano salvo!')
  }, [planId, planItems])

  function changeWeek(delta: number) {
    const current = new Date(weekStart + 'T00:00:00')
    setWeekStart(formatWeekStart(addWeeks(current, delta)))
  }

  if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>

  return (
    <TeacherLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link to={`/professor/alunos/${studentId}`} className="text-gray-400 hover:text-gray-600 transition">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E3A5F]">Plano semanal</h1>
          <p className="text-xs text-gray-400 mt-0.5">{studentName}</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs"
        >
          {saving ? 'Salvando...' : 'Salvar plano'}
        </Button>
      </div>

      {/* Navegação de semana */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-5">
        <button onClick={() => changeWeek(-1)} className="text-gray-400 hover:text-[#1E3A5F] transition">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6"/>
          </svg>
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
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Grid de dias */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeDays.map(day => (
            <DayColumn
              key={day}
              day={day}
              items={planItems.filter(i => i.day_of_week === day)}
              availability={availability.find(a => a.day_of_week === day)}
              onRemove={handleRemove}
              onDurationChange={handleDurationChange}
              onAddItem={handleAddItem}
              repertoire={repertoire}
            />
          ))}
        </div>

        {activeDays.length === 0 && (
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
        )}

        <DragOverlay>
          {activeItem && (
            <div className="bg-white border border-[#4A90C4] rounded-xl px-3 py-2.5 shadow-lg">
              <p className="text-xs font-semibold text-gray-700">
                {activeItem.piece?.title ?? activeItem.exercise?.title}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Legenda */}
      {activeDays.length > 0 && (
        <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-400">
          <div className="flex items-center gap-1">
            <span className="bg-[#D6E4F0] text-[#1E3A5F] font-bold px-1.5 py-0.5 rounded-md">PEÇA</span>
            <span>Peça musical</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-purple-100 text-purple-600 font-bold px-1.5 py-0.5 rounded-md">EX</span>
            <span>Exercício</span>
          </div>
        </div>
      )}
    </TeacherLayout>
  )
}