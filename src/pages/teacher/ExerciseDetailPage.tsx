import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdTaskAlt, MdDeleteOutline, MdEdit } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

interface Exercise {
  id: string
  title: string
  category: string
  objective: string | null
  difficulty: number | null
  notes: string | null
  status: string
}

interface ChecklistItem {
  id: string
  title: string
  category: string | null
  position: number
  is_optional: boolean
  completed: boolean
}

const categoryLabel: Record<string, string> = {
  technique: 'Técnica',
  other: 'Outro',
}

const statusOptions = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'completed', label: 'Concluído' },
]

export default function ExerciseDetailPage() {
  const { studentId, exerciseId } = useParams()
  const navigate = useNavigate()

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    if (exerciseId && studentId) fetchAll()
  }, [exerciseId, studentId])

  async function fetchAll() {
    const [exerciseRes, checklistRes, completionsRes] = await Promise.all([
      supabase.from('exercises').select('*').eq('id', exerciseId!).single(),
      supabase.from('checklist_items').select('*').eq('exercise_id', exerciseId!).order('position'),
      supabase.from('checklist_completions').select('checklist_item_id').eq('student_id', studentId!),
    ])

    const completedIds = new Set(
      (completionsRes.data ?? []).map((c: { checklist_item_id: string }) => c.checklist_item_id)
    )

    setExercise(exerciseRes.data)
    setChecklist(
      (checklistRes.data ?? []).map((item: ChecklistItem) => ({
        ...item,
        completed: completedIds.has(item.id),
      }))
    )
    setLoading(false)
  }

  async function toggleItem(item: ChecklistItem) {
    if (item.completed) {
      const { error } = await supabase
        .from('checklist_completions')
        .delete()
        .eq('checklist_item_id', item.id)
        .eq('student_id', studentId!)
      if (error) console.error('[checklist] delete error:', error.message)
    } else {
      const { error } = await supabase
        .from('checklist_completions')
        .insert({ checklist_item_id: item.id, student_id: studentId! })
      if (error) console.error('[checklist] insert error:', error.message)
    }

    setChecklist(prev =>
      prev.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c)
    )
  }

  async function addCustomItem() {
    if (!newItemTitle.trim()) return
    setAddingItem(true)

    const maxPosition = checklist.length > 0 ? Math.max(...checklist.map(c => c.position)) + 1 : 0

    const { data } = await supabase
      .from('checklist_items')
      .insert({
        exercise_id: exerciseId!,
        title: newItemTitle.trim(),
        category: 'Personalizado',
        position: maxPosition,
        is_default: false,
        is_optional: false,
      })
      .select()
      .single()

    if (data) {
      setChecklist(prev => [...prev, { ...data, completed: false }])
      toast.success('Item adicionado')
    }

    setNewItemTitle('')
    setAddingItem(false)
  }

  async function updateStatus(newStatus: string) {
    setSavingStatus(true)
    await supabase.from('exercises').update({ status: newStatus }).eq('id', exerciseId!)
    setExercise(prev => prev ? { ...prev, status: newStatus } : prev)
    setSavingStatus(false)
    toast.success('Status atualizado')
  }

  async function deleteItem(itemId: string) {
    await supabase.from('checklist_items').delete().eq('id', itemId)
    setChecklist(prev => prev.filter(c => c.id !== itemId))
  }

  async function deleteExercise() {
    if (!confirm('Excluir este exercício? Esta ação não pode ser desfeita.')) return
    await supabase.from('exercises').delete().eq('id', exerciseId!)
    toast.success('Exercício excluído')
    navigate(`/professor/alunos/${studentId}?tab=repertoire`)
  }

  if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>
  if (!exercise) return <TeacherLayout><p className="text-sm text-red-400">Exercício não encontrado.</p></TeacherLayout>

  const grouped = checklist.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const cat = item.category ?? 'Geral'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const completedCount = checklist.filter(c => c.completed).length
  const totalCount = checklist.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <TeacherLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}?tab=repertoire`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E3A5F]">{exercise.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{categoryLabel[exercise.category] ?? exercise.category}</p>
        </div>
        <Link to={`/professor/alunos/${studentId}/exercicios/${exerciseId}/editar`} className="text-gray-400 hover:text-[#4A90C4] transition">
          <MdEdit size={20} />
        </Link>
      </div>

      {/* Progresso */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-600">Progresso</span>
          <span className="text-xl font-bold text-[#1E3A5F]">{pct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4A90C4] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Status */}
        <div className="mt-4 space-y-1">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            value={exercise.status}
            onChange={e => updateStatus(e.target.value)}
            disabled={savingStatus}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white"
          >
            {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 mb-4"><MdTaskAlt size={15} />Checklist</h2>

        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{category}</p>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 group">
                    <button
                      onClick={() => toggleItem(item)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                        item.completed
                          ? 'bg-[#1E3A5F] border-[#1E3A5F]'
                          : 'border-gray-300 hover:border-[#4A90C4]'
                      }`}
                    >
                      {item.completed && (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>
                    <span className={`text-sm flex-1 ${item.completed ? 'line-through text-gray-300' : 'text-gray-700'} ${item.is_optional ? 'italic' : ''}`}>
                      {item.title}
                      {item.is_optional && <span className="text-xs text-gray-400 ml-1">(opcional)</span>}
                    </span>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition text-xs shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Adicionar item personalizado */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Adicionar item personalizado</p>
          <div className="flex gap-2">
            <input
              value={newItemTitle}
              onChange={e => setNewItemTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomItem())}
              placeholder="Ex: Praticar no andamento 120 BPM"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
            />
            <Button
              onClick={addCustomItem}
              disabled={addingItem || !newItemTitle.trim()}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs px-4"
            >
              {addingItem ? '...' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Detalhes */}
      {(exercise.difficulty || exercise.objective || exercise.notes) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-600">Detalhes</h2>
          {exercise.difficulty && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Dificuldade</span>
              <span className="text-xs font-medium text-gray-700">{exercise.difficulty}/10</span>
            </div>
          )}
          {exercise.objective && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Objetivo</p>
              <p className="text-xs text-gray-600 leading-relaxed">{exercise.objective}</p>
            </div>
          )}
          {exercise.notes && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Observações</p>
              <p className="text-xs text-gray-600 leading-relaxed">{exercise.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Excluir */}
      <button
        onClick={deleteExercise}
        className="w-full py-3 rounded-2xl border border-red-200 text-sm font-medium text-red-400 hover:bg-red-50 transition flex items-center justify-center gap-1.5"
      >
        <MdDeleteOutline size={16} />
        Excluir exercício
      </button>
    </TeacherLayout>
  )
}
