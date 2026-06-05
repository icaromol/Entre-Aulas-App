import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { StudentLayout } from '@/components/layout/StudentLayout'
import type { PlanItem } from '@/types/plan'
import { getMonday, formatWeekStart, getDayFullLabel, getTodayDayOfWeek } from '@/lib/weekUtils'

export default function TodayPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const today = getTodayDayOfWeek()
  const weekStart = formatWeekStart(getMonday(new Date()))

  useEffect(() => {
    if (profile) fetchTodayPlan()
  }, [profile])

  async function fetchTodayPlan() {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()

    if (!student) { setLoading(false); return }
    setStudentId(student.id)

    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('student_id', student.id)
      .eq('week_start', weekStart)
      .single()

    if (!plan) { setLoading(false); return }

    const { data: planItems } = await supabase
      .from('plan_items')
      .select(`
        *,
        piece:pieces(title, composer, completion_pct),
        exercise:exercises(title, category)
      `)
      .eq('plan_id', plan.id)
      .eq('day_of_week', today)
      .order('position')

    setItems((planItems ?? []).map((item: PlanItem) => ({
      ...item,
      piece: item.piece ?? undefined,
      exercise: item.exercise ?? undefined,
    })))
    setLoading(false)
  }

  async function toggleDone(item: PlanItem) {
    const newDone = !item.is_done
    await supabase
      .from('plan_items')
      .update({ is_done: newDone, done_at: newDone ? new Date().toISOString() : null })
      .eq('id', item.id)

    setItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, is_done: newDone } : i)
    )
  }

  const done = items.filter(i => i.is_done).length
  const total = items.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const totalMinutes = items.reduce((sum, i) => sum + (i.duration_minutes ?? 0), 0)

  if (loading) {
    return (
      <StudentLayout>
        <p className="text-sm text-gray-400">Carregando...</p>
      </StudentLayout>
    )
  }

  return (
    <StudentLayout>
      {/* Saudação */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1E3A5F]">
          Olá, {profile?.first_name} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">{getDayFullLabel(today)}</p>
      </div>

      {/* Progresso do dia */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">Progresso de hoje</span>
            <span className="text-xs font-bold text-[#1E3A5F]">{done}/{total} itens</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4A90C4] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">{totalMinutes} min planejados</p>
        </div>
      )}

      {/* Lista de itens */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🎵</p>
          <p className="text-sm font-semibold text-gray-600">Nenhum item para hoje</p>
          <p className="text-xs text-gray-400 mt-1">
            Seu professor ainda não montou o plano desta semana.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const title = item.piece?.title ?? item.exercise?.title ?? '—'
            const subtitle = item.piece
              ? item.piece.composer ?? 'Peça'
              : item.exercise
              ? item.exercise.category
              : ''

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition ${
                  item.is_done ? 'border-gray-100 opacity-60' : 'border-gray-100'
                }`}
              >
                <div className="px-4 py-4 flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleDone(item)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                      item.is_done
                        ? 'bg-[#1E3A5F] border-[#1E3A5F]'
                        : 'border-gray-300 hover:border-[#4A90C4]'
                    }`}
                  >
                    {item.is_done && (
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${item.is_done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
                  </div>

                  {/* Tempo */}
                  {item.duration_minutes && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {item.duration_minutes} min
                    </span>
                  )}
                </div>

                {/* Botão pomodoro */}
                {!item.is_done && (
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => navigate('/aluno/pomodoro', {
                        state: {
                          planItemId: item.id,
                          title,
                          durationMinutes: item.duration_minutes,
                          studentId,
                        }
                      })}
                      className="w-full py-2 rounded-xl bg-[#D6E4F0] text-[#1E3A5F] text-xs font-semibold hover:bg-[#4A90C4] hover:text-white transition flex items-center justify-center gap-2"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M12 7v5l3 3"/>
                      </svg>
                      Iniciar pomodoro
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Mensagem de conclusão */}
      {total > 0 && done === total && (
        <div className="mt-5 bg-[#D6E4F0] rounded-2xl p-4 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm font-bold text-[#1E3A5F]">Parabéns! Você completou o estudo de hoje.</p>
        </div>
      )}
    </StudentLayout>
  )
}