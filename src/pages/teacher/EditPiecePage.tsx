import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdMusicNote, MdNotes } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

const PERIODS = [
  { value: 'baroque', label: 'Barroco' },
  { value: 'classical', label: 'Clássico' },
  { value: 'romantic', label: 'Romântico' },
  { value: 'modern', label: 'Moderno' },
  { value: 'contemporary', label: 'Contemporâneo' },
  { value: 'popular', label: 'Popular' },
  { value: 'other', label: 'Outro' },
]

export default function EditPiecePage() {
  const { studentId, pieceId } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [catalogNumber, setCatalogNumber] = useState('')
  const [period, setPeriod] = useState('')
  const [difficulty, setDifficulty] = useState<number>(5)
  const [pedagogicalGoal, setPedagogicalGoal] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (pieceId) fetchPiece()
  }, [pieceId])

  async function fetchPiece() {
    const { data } = await supabase.from('pieces').select('*').eq('id', pieceId!).single()
    if (data) {
      setTitle(data.title)
      setComposer(data.composer ?? '')
      setCatalogNumber(data.catalog_number ?? '')
      setPeriod(data.period ?? '')
      setDifficulty(data.difficulty ?? 5)
      setPedagogicalGoal(data.pedagogical_goal ?? '')
      setNotes(data.notes ?? '')
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const { error: updateError } = await supabase
        .from('pieces')
        .update({
          title,
          composer: composer || null,
          catalog_number: catalogNumber || null,
          period: period || null,
          difficulty,
          pedagogical_goal: pedagogicalGoal || null,
          notes: notes || null,
        })
        .eq('id', pieceId!)

      if (updateError) throw new Error('Erro ao salvar.')
      toast.success('Peça atualizada!')
      navigate(`/professor/alunos/${studentId}/pecas/${pieceId}`)
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
        <Link to={`/professor/alunos/${studentId}/pecas/${pieceId}`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Editar peça</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl mx-auto">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdMusicNote size={15} />Identificação</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Título da peça</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Ex: Sonata Op. 2 nº 1"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Compositor</label>
            <input value={composer} onChange={e => setComposer(e.target.value)}
              placeholder="Ex: Ludwig van Beethoven"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Número de catálogo</label>
              <input value={catalogNumber} onChange={e => setCatalogNumber(e.target.value)}
                placeholder="Ex: Op. 2 nº 1"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Período</label>
              <select value={period} onChange={e => setPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white">
                <option value="">Selecione...</option>
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Objetivo pedagógico</label>
            <textarea value={pedagogicalGoal} onChange={e => setPedagogicalGoal(e.target.value)} rows={2}
              placeholder="O que o aluno deve desenvolver com essa peça..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdNotes size={15} />Observações</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Anotações sobre a peça..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" disabled={saving}
          className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10">
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>

      </form>
    </TeacherLayout>
  )
}
