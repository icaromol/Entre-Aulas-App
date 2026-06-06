import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdSchool, MdNotes, MdAdd } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

const CATEGORIES = [
  { value: 'technique', label: 'Técnica' },
  { value: 'ear_training', label: 'Percepção musical' },
  { value: 'harmony', label: 'Harmonia' },
  { value: 'history', label: 'História da música' },
  { value: 'improvisation', label: 'Improvisação' },
  { value: 'other', label: 'Outro' },
]

const DEFAULT_EXERCISE_CHECKLIST = [
  { title: 'Compreensão do conceito', category: 'Estudo', position: 0, is_optional: false },
  { title: 'Execução lenta e consciente', category: 'Prática', position: 1, is_optional: false },
  { title: 'Execução em andamento de estudo', category: 'Prática', position: 2, is_optional: false },
  { title: 'Aplicação em contexto musical', category: 'Aplicação', position: 3, is_optional: false },
  { title: 'Execução em andamento final', category: 'Aplicação', position: 4, is_optional: false },
]

export default function NewExercisePage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('technique')
  const [objective, setObjective] = useState('')
  const [difficulty, setDifficulty] = useState<number>(5)
  const [notes, setNotes] = useState('')
  const [checklistItems, setChecklistItems] = useState(
    DEFAULT_EXERCISE_CHECKLIST.map((item, i) => ({ ...item, tempId: i }))
  )
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function removeChecklistItem(tempId: number) {
    setChecklistItems(prev => prev.filter(i => i.tempId !== tempId))
  }

  function addChecklistItem() {
    if (!newChecklistTitle.trim()) return
    setChecklistItems(prev => [...prev, {
      title: newChecklistTitle.trim(),
      category: 'Personalizado',
      position: prev.length,
      is_optional: false,
      tempId: Date.now(),
    }])
    setNewChecklistTitle('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: exercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          student_id: studentId!,
          title,
          category,
          objective: objective || null,
          difficulty,
          notes: notes || null,
          status: 'active',
        })
        .select('id')
        .single()

      if (exerciseError || !exercise) throw new Error('Erro ao criar exercício.')

      // Checklist do exercício
      await supabase.from('checklist_items').insert(
        checklistItems.map((item, idx) => ({
          exercise_id: exercise.id,
          title: item.title,
          category: item.category,
          position: idx,
          is_default: false,
          is_optional: item.is_optional,
        }))
      )

      toast.success('Exercício criado!')
      navigate(`/professor/alunos/${studentId}?tab=exercises`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}?tab=exercises`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Novo exercício</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl mx-auto">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdSchool size={15} />Identificação</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Nome do exercício</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Ex: Escalas maiores em todas as tonalidades"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition text-left ${
                    category === cat.value
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                  }`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Objetivo</label>
            <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2}
              placeholder="O que o aluno deve desenvolver com esse exercício..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-500">Dificuldade</label>
              <span className="text-xs font-bold text-[#1E3A5F]">{difficulty}/10</span>
            </div>
            <input type="range" min={1} max={10} value={difficulty}
              onChange={e => setDifficulty(Number(e.target.value))}
              className="w-full accent-[#1E3A5F]" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdNotes size={15} />Observações</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Anotações sobre o exercício..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
        </div>

        {/* Checklist editável */}
        <div className="bg-[#F5F7FA] rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Checklist</h2>
          <div className="space-y-1.5 mb-4">
            {checklistItems.map(item => (
              <div key={item.tempId} className="flex items-center gap-2 group">
                <div className="w-3.5 h-3.5 rounded border border-gray-300 shrink-0" />
                <span className="text-xs flex-1 text-gray-600">{item.title}</span>
                <button
                  type="button"
                  onClick={() => removeChecklistItem(item.tempId)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition text-xs shrink-0"
                >✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-3 border-t border-gray-200">
            <input
              value={newChecklistTitle}
              onChange={e => setNewChecklistTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
              placeholder="Adicionar item ao checklist..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#4A90C4] transition"
            />
            <button
              type="button"
              onClick={addChecklistItem}
              className="px-3 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-xs hover:bg-[#1E3A5F]/90 transition"
            >+</button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" disabled={loading}
          className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10">
          {loading ? 'Criando...' : <span className="flex items-center gap-1.5 justify-center"><MdAdd size={16} />Criar exercício</span>}
        </Button>

      </form>
    </TeacherLayout>
  )
}