import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdSchool, MdNotes } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'

const CATEGORIES = [
  { value: 'technique',     label: 'Técnica' },
  { value: 'ear_training',  label: 'Percepção' },
  { value: 'harmony',       label: 'Harmonia' },
  { value: 'history',       label: 'História' },
  { value: 'improvisation', label: 'Improvisação' },
  { value: 'other',         label: 'Outro' },
]

export default function StudentEditExercisePage() {
  const { exerciseId } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('technique')
  const [objective, setObjective] = useState('')
  const [difficulty, setDifficulty] = useState<number>(5)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (exerciseId) fetchExercise()
  }, [exerciseId])

  async function fetchExercise() {
    const { data } = await supabase.from('exercises').select('*').eq('id', exerciseId!).single()
    if (data) {
      setTitle(data.title); setCategory(data.category)
      setObjective(data.objective ?? ''); setDifficulty(data.difficulty ?? 5); setNotes(data.notes ?? '')
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const { error: updateError } = await supabase.from('exercises')
        .update({ title, category, objective: objective || null, difficulty, notes: notes || null })
        .eq('id', exerciseId!)
      if (updateError) throw new Error('Erro ao salvar.')
      toast.success('Exercício atualizado!')
      navigate(`/aluno/repertorio/exercicios/${exerciseId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  if (!isValidUUID(exerciseId)) return <Navigate to="/" replace />
  if (loading) return <StudentLayout><div className="flex justify-center py-12"><Spinner /></div></StudentLayout>

  return (
    <StudentLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/aluno/repertorio/exercicios/${exerciseId}`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#153b50]">Editar exercício</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdSchool size={15} />Identificação</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Nome do exercício</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Categoria</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition text-center ${
                    category === cat.value
                      ? 'bg-[#153b50] text-white border-[#153b50]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#b2f0fb]'
                  }`}>{cat.label}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Objetivo</label>
            <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2} maxLength={500}
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

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdNotes size={15} />Observações</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] transition resize-none" />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" disabled={saving}
          className="w-full bg-[#153b50] hover:bg-[#153b50]/90 text-white rounded-xl h-10">
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>

      </form>
    </StudentLayout>
  )
}
