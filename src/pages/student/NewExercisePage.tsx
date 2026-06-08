import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdSchool, MdNotes } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'
import { ChecklistEditor, type ChecklistEditorItem } from '@/components/checklist/ChecklistEditor'

const CATEGORIES = [
  { value: 'technique',      label: 'Técnica' },
  { value: 'ear_training',   label: 'Percepção' },
  { value: 'harmony',        label: 'Harmonia' },
  { value: 'history',        label: 'História' },
  { value: 'improvisation',  label: 'Improvisação' },
  { value: 'other',          label: 'Outro' },
]

const DEFAULT_EXERCISE_CHECKLIST = [
  { title: 'Compreensão e execução lenta',      category: 'Etapas', position: 0, is_optional: false },
  { title: 'Domínio das dificuldades técnicas', category: 'Etapas', position: 1, is_optional: false },
  { title: 'Fluência no estudo',                category: 'Etapas', position: 2, is_optional: false },
  { title: 'Integrado ao repertório / musical', category: 'Etapas', position: 3, is_optional: false },
]

const DEFAULT_ITEMS = (): ChecklistEditorItem[] => DEFAULT_EXERCISE_CHECKLIST.map((item, i) => ({ ...item, tempId: i }))

export default function StudentNewExercisePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState<string | null>(null)

  const [title, setTitle]           = useState('')
  const [category, setCategory]     = useState('technique')
  const [objective, setObjective]   = useState('')
  const [difficulty, setDifficulty] = useState<number>(5)
  const [notes, setNotes]           = useState('')

  const [checklistItems, setChecklistItems] = useState<ChecklistEditorItem[]>(DEFAULT_ITEMS)

  const [keepCreating, setKeepCreating] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  useEffect(() => {
    if (!profile) return
    supabase.from('students').select('id').eq('profile_id', profile.id).single()
      .then(({ data, error }) => {
        if (data) setStudentId(data.id)
        else if (error) setError('Não foi possível carregar seu perfil de aluno. Tente recarregar a página.')
      })
  }, [profile])

  function resetForm() {
    setTitle(''); setCategory('technique'); setObjective(''); setDifficulty(5); setNotes('')
    setChecklistItems(DEFAULT_ITEMS())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId) { setError('Perfil de aluno não encontrado. Tente recarregar a página.'); return }
    setError(''); setLoading(true)
    try {
      const { data: exercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          student_id: studentId, title, category,
          objective: objective || null, difficulty,
          notes: notes || null, status: 'active',
        })
        .select('id').single()

      if (exerciseError || !exercise) throw new Error('Erro ao criar exercício.')

      await supabase.from('checklist_items').insert(
        checklistItems.map((item, idx) => ({
          exercise_id: exercise.id, title: item.title, category: item.category,
          position: idx, is_default: false, is_optional: item.is_optional,
        }))
      )

      if (keepCreating) {
        resetForm()
        window.scrollTo({ top: 0, behavior: 'smooth' })
        toast.success('Exercício criado!')
      } else {
        toast.success('Exercício criado!')
        navigate(`/aluno/repertorio/exercicios/${exercise.id}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <StudentLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/aluno/repertorio?tab=exercises" className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Novo exercício</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdSchool size={15} /> Identificação
          </h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Nome do exercício</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}
              placeholder="Ex: Escalas maiores em todas as tonalidades"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Categoria</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition text-center ${
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
            <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2} maxLength={500}
              placeholder="O que você quer desenvolver com esse exercício..."
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
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdNotes size={15} /> Observações
          </h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000}
            placeholder="Anotações sobre o exercício..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
        </div>

        {/* Checklist */}
        <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="space-y-3 pb-6">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={keepCreating} onChange={e => setKeepCreating(e.target.checked)}
              className="w-4 h-4 accent-[#4A90C4] rounded" />
            <span className="text-sm text-gray-500">Continuar criando</span>
          </label>
          <div className="flex gap-3">
            <Button type="button" variant="outline"
              onClick={() => navigate('/aluno/repertorio?tab=exercises')}
              className="flex-1 rounded-xl border-gray-200 text-gray-600">Cancelar</Button>
            <Button type="submit" disabled={loading}
              className="flex-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10">
              {loading ? 'Criando...' : keepCreating ? 'Criar e continuar' : 'Criar exercício'}
            </Button>
          </div>
        </div>

      </form>
    </StudentLayout>
  )
}
