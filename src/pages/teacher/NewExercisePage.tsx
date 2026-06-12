import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdSchool, MdNotes } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/utils'
import { autoGeneratePlan } from '@/lib/autoplan'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'
import { ChecklistEditor, type ChecklistEditorItem } from '@/components/checklist/ChecklistEditor'

const CATEGORIES = [
  { value: 'technique', label: 'Técnica' },
  { value: 'other',     label: 'Outro' },
]

const DEFAULT_EXERCISE_CHECKLIST = [
  { title: 'Compreensão e execução lenta',       category: 'Etapas', position: 0, is_optional: false },
  { title: 'Domínio das dificuldades técnicas',  category: 'Etapas', position: 1, is_optional: false },
  { title: 'Fluência no estudo',                 category: 'Etapas', position: 2, is_optional: false },
  { title: 'Integrado ao repertório / musical',  category: 'Etapas', position: 3, is_optional: false },
]

const DEFAULT_ITEMS = (): ChecklistEditorItem[] => DEFAULT_EXERCISE_CHECKLIST.map((item, i) => ({ ...item, tempId: i }))

export default function NewExercisePage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  // ── Form fields ───────────────────────────────────────────────────────────
  const [title, setTitle]         = useState('')
  const [category, setCategory]   = useState('technique')
  const [objective, setObjective] = useState('')
  const [difficulty, setDifficulty] = useState<number>(5)
  const [notes, setNotes]         = useState('')

  // ── Checklist state ───────────────────────────────────────────────────────
  const [checklistItems, setChecklistItems] = useState<ChecklistEditorItem[]>(DEFAULT_ITEMS)

  // ── Submit state ──────────────────────────────────────────────────────────
  const [keepCreating, setKeepCreating] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  function resetForm() {
    setTitle('')
    setCategory('technique')
    setObjective('')
    setDifficulty(5)
    setNotes('')
    setChecklistItems(DEFAULT_ITEMS())
  }

  // ── Submit ────────────────────────────────────────────────────────────────

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

      autoGeneratePlan(studentId!)
      if (keepCreating) {
        resetForm()
        window.scrollTo({ top: 0, behavior: 'smooth' })
        toast.success('Exercício criado! Formulário pronto para novo exercício.')
      } else {
        toast.success('Exercício criado!')
        navigate(`/professor/alunos/${studentId}?tab=repertoire`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isValidUUID(studentId)) return <Navigate to="/" replace />

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}?tab=repertoire`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#153b50]">Novo exercício</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Identificação */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdSchool size={15} /> Identificação
          </h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Nome do exercício</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}
              placeholder="Ex: Escalas maiores em todas as tonalidades"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition text-left ${
                    category === cat.value
                      ? 'bg-[#153b50] text-white border-[#153b50]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#b2f0fb]'
                  }`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Objetivo</label>
            <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2} maxLength={500}
              placeholder="O que o aluno deve desenvolver com esse exercício..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] transition resize-none" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-500">Dificuldade</label>
              <span className="text-xs font-bold text-[#153b50]">{difficulty}/10</span>
            </div>
            <input type="range" min={1} max={10} value={difficulty}
              onChange={e => setDifficulty(Number(e.target.value))}
              className="w-full accent-[#153b50]" />
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdNotes size={15} /> Observações
          </h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000}
            placeholder="Anotações sobre o exercício..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] transition resize-none" />
        </div>

        {/* Checklist */}
        <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Continuar criando + botões */}
        <div className="space-y-3 pb-6">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepCreating}
              onChange={e => setKeepCreating(e.target.checked)}
              className="w-4 h-4 accent-[#b2f0fb] rounded"
            />
            <span className="text-sm text-gray-500">Continuar criando</span>
          </label>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/professor/alunos/${studentId}?tab=repertoire`)}
              className="flex-1 rounded-xl border-gray-200 text-gray-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#153b50] hover:bg-[#153b50]/90 text-white rounded-xl h-10"
            >
              {loading ? 'Criando...' : keepCreating ? 'Criar e continuar' : 'Criar exercício'}
            </Button>
          </div>
        </div>

      </form>
    </TeacherLayout>
  )
}
