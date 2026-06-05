import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { StudentLayout } from '@/components/layout/StudentLayout'

interface Goal {
  id: string
  title: string
  type: string
  target_value: string | null
  due_date: string | null
  notes: string | null
  status: string
  checklist_item_id: string | null
  exercise_id: string | null
  checklist_item: { id: string; title: string; piece: { title: string } | null } | null
  exercise: { id: string; title: string } | null
}

const typeLabel: Record<string, string> = {
  free: 'Livre',
  measurable: 'Mensurável',
  checklist_item: 'Checklist',
  exercise: 'Exercício',
}

const typeBadge: Record<string, string> = {
  free: 'bg-blue-50 text-blue-600',
  measurable: 'bg-amber-50 text-amber-700',
  checklist_item: 'bg-purple-50 text-purple-600',
  exercise: 'bg-green-50 text-green-700',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function GoalsPage() {
  const { profile } = useAuth()

  const [goals, setGoals] = useState<Goal[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    if (profile) fetchAll()
  }, [profile])

  async function fetchAll() {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()

    if (!student) { setLoading(false); return }

    const [goalsRes, completionsRes] = await Promise.all([
      supabase
        .from('goals')
        .select(`
          *,
          checklist_item:checklist_items(id, title, piece:pieces(title)),
          exercise:exercises(id, title)
        `)
        .eq('student_id', student.id)
        .order('due_date', { ascending: true }),
      supabase
        .from('checklist_completions')
        .select('checklist_item_id')
        .eq('student_id', student.id),
    ])

    setGoals(goalsRes.data ?? [])
    setCompletedIds(new Set(
      (completionsRes.data ?? []).map((c: { checklist_item_id: string }) => c.checklist_item_id)
    ))
    setLoading(false)
  }

  if (loading) {
    return (
      <StudentLayout>
        <p className="text-sm text-gray-400">Carregando...</p>
      </StudentLayout>
    )
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <StudentLayout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1E3A5F]">Metas</h1>
        <p className="text-sm text-gray-400 mt-0.5">Objetivos definidos pelo seu professor</p>
      </div>

      {/* Metas ativas */}
      {activeGoals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-sm font-semibold text-gray-600">Nenhuma meta ativa</p>
          <p className="text-xs text-gray-400 mt-1">Seu professor ainda não definiu metas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeGoals.map(goal => {
            const isAutoCompleted = goal.type === 'checklist_item' && goal.checklist_item_id
              ? completedIds.has(goal.checklist_item_id)
              : false

            return (
              <div
                key={goal.id}
                className={`bg-white rounded-2xl border p-4 ${isAutoCompleted ? 'border-green-200' : 'border-gray-100'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`text-sm font-semibold flex-1 ${isAutoCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {goal.title}
                  </p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${typeBadge[goal.type] ?? 'bg-gray-100 text-gray-500'}`}>
                    {typeLabel[goal.type] ?? goal.type}
                  </span>
                </div>

                {isAutoCompleted && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <span className="text-xs text-green-600 font-medium">Item concluído</span>
                  </div>
                )}

                <div className="space-y-1">
                  {goal.target_value && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Alvo:</span> {goal.target_value}
                    </p>
                  )}
                  {goal.checklist_item && (
                    <p className="text-xs text-gray-400">
                      {goal.checklist_item.piece?.title} — {goal.checklist_item.title}
                    </p>
                  )}
                  {goal.exercise && (
                    <p className="text-xs text-gray-400">{goal.exercise.title}</p>
                  )}
                  {goal.notes && (
                    <p className="text-xs text-gray-400 leading-relaxed mt-1">{goal.notes}</p>
                  )}
                  {goal.due_date && (
                    <p className="text-xs text-gray-400 mt-1">Prazo: {formatDate(goal.due_date)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Metas concluídas */}
      {completedGoals.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-3 w-full"
          >
            <svg
              width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}
            >
              <path d="M9 18l6-6-6-6"/>
            </svg>
            Concluídas ({completedGoals.length})
          </button>

          {showCompleted && (
            <div className="space-y-3">
              {completedGoals.map(goal => (
                <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 p-4 opacity-60">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-400 line-through flex-1">{goal.title}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${typeBadge[goal.type] ?? 'bg-gray-100 text-gray-500'}`}>
                      {typeLabel[goal.type] ?? goal.type}
                    </span>
                  </div>
                  {goal.due_date && (
                    <p className="text-xs text-gray-400 mt-1">Prazo: {formatDate(goal.due_date)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </StudentLayout>
  )
}
