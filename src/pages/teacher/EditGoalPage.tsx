import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MdArrowBack, MdNotes } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

interface PieceOption {
  id: string
  title: string
  checklist_items: { id: string; title: string }[]
}

interface ExerciseOption {
  id: string
  title: string
}

type GoalType = 'free' | 'measurable' | 'checklist_item' | 'exercise'

const TYPE_OPTIONS: { value: GoalType; label: string; description: string }[] = [
  { value: 'free',           label: 'Livre',       description: 'Objetivo aberto' },
  { value: 'measurable',     label: 'Mensurável',  description: 'Com valor alvo' },
  { value: 'checklist_item', label: 'Checklist',   description: 'Item de uma peça' },
  { value: 'exercise',       label: 'Exercício',   description: 'Vinculado a exercício' },
]

export default function EditGoalPage() {
  const { studentId, goalId } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [type, setType] = useState<GoalType>('free')
  const [targetValue, setTargetValue] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedPieceId, setSelectedPieceId] = useState('')
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [pieces, setPieces] = useState<PieceOption[]>([])
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const [goalRes, piecesRes, exercisesRes] = await Promise.all([
      supabase.from('goals').select('*').eq('id', goalId!).single(),
      supabase.from('pieces').select('id, title, checklist_items(id, title)').eq('student_id', studentId!).order('title'),
      supabase.from('exercises').select('id, title').eq('student_id', studentId!).order('title'),
    ])

    const goal = goalRes.data
    if (goal) {
      setTitle(goal.title)
      setType(goal.type as GoalType)
      setTargetValue(goal.target_value ?? '')
      setDueDate(goal.due_date ?? '')
      setNotes(goal.notes ?? '')
      setSelectedChecklistItemId(goal.checklist_item_id ?? '')
      setSelectedExerciseId(goal.exercise_id ?? '')

      // Se for checklist_item, precisamos saber qual peça corresponde ao item
      if (goal.checklist_item_id && piecesRes.data) {
        const piece = (piecesRes.data as PieceOption[]).find(p =>
          p.checklist_items.some(ci => ci.id === goal.checklist_item_id)
        )
        if (piece) setSelectedPieceId(piece.id)
      }
    }

    setPieces(piecesRes.data ?? [])
    setExercises(exercisesRes.data ?? [])
    setLoading(false)
  }

  const selectedPiece = pieces.find(p => p.id === selectedPieceId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (type === 'checklist_item' && !selectedChecklistItemId) {
      setError('Selecione um item do checklist.')
      return
    }
    if (type === 'exercise' && !selectedExerciseId) {
      setError('Selecione um exercício.')
      return
    }

    setSaving(true)

    try {
      const { error: updateError } = await supabase.from('goals').update({
        title,
        type,
        target_value: type === 'measurable' ? (targetValue || null) : null,
        due_date: dueDate || null,
        notes: notes || null,
        checklist_item_id: type === 'checklist_item' ? selectedChecklistItemId : null,
        exercise_id: type === 'exercise' ? selectedExerciseId : null,
      }).eq('id', goalId!)

      if (updateError) throw new Error(updateError.message)

      navigate(`/professor/alunos/${studentId}?tab=goals`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}?tab=goals`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Editar meta</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Título da meta</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="Ex: Tocar a Sonatina sem olhar para as mãos"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
            />
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setType(opt.value)
                    setSelectedPieceId('')
                    setSelectedChecklistItemId('')
                    setSelectedExerciseId('')
                  }}
                  className={`py-2.5 px-3 rounded-lg border text-left transition ${
                    type === opt.value
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                  }`}
                >
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className={`text-[10px] mt-0.5 ${type === opt.value ? 'text-blue-200' : 'text-gray-400'}`}>
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Valor alvo */}
          {type === 'measurable' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Valor alvo</label>
              <input
                value={targetValue}
                onChange={e => setTargetValue(e.target.value)}
                placeholder="Ex: 120 BPM, 30 dias consecutivos"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
              />
            </div>
          )}

          {/* Vínculo: checklist_item */}
          {type === 'checklist_item' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Peça</label>
                <select
                  value={selectedPieceId}
                  onChange={e => { setSelectedPieceId(e.target.value); setSelectedChecklistItemId('') }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white"
                >
                  <option value="">Selecione uma peça...</option>
                  {pieces.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              {selectedPiece && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Item do checklist</label>
                  <select
                    value={selectedChecklistItemId}
                    onChange={e => setSelectedChecklistItemId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white"
                  >
                    <option value="">Selecione um item...</option>
                    {selectedPiece.checklist_items.map(item => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Vínculo: exercise */}
          {type === 'exercise' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Exercício</label>
              <select
                value={selectedExerciseId}
                onChange={e => setSelectedExerciseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white"
              >
                <option value="">Selecione um exercício...</option>
                {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
              </select>
            </div>
          )}

          {/* Prazo */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Prazo (opcional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
            />
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdNotes size={15} />Observações</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Contexto ou critério de avaliação..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          type="submit"
          disabled={saving}
          className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>

      </form>
    </TeacherLayout>
  )
}
