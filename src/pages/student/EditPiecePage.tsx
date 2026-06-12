import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdMusicNote, MdNotes } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
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

export default function StudentEditPiecePage() {
  const { pieceId } = useParams()
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
    setError(''); setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('pieces')
        .update({
          title, composer: composer || null,
          catalog_number: catalogNumber || null,
          period: period || null, difficulty,
          pedagogical_goal: pedagogicalGoal || null,
          notes: notes || null,
        })
        .eq('id', pieceId!)

      if (updateError) throw new Error('Erro ao salvar.')
      toast.success('Peça atualizada!')
      navigate(`/aluno/repertorio/pecas/${pieceId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  if (!isValidUUID(pieceId)) return <Navigate to="/" replace />
  if (loading) return <StudentLayout><div className="flex justify-center py-12"><Spinner /></div></StudentLayout>

  return (
    <StudentLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/aluno/repertorio/pecas/${pieceId}`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#153b50]">Editar peça</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdMusicNote size={15} />Identificação</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Título da peça</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Compositor</label>
            <input value={composer} onChange={e => setComposer(e.target.value)} maxLength={150}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Número de catálogo</label>
              <input value={catalogNumber} onChange={e => setCatalogNumber(e.target.value)} maxLength={50}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Período</label>
              <select value={period} onChange={e => setPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] transition bg-white">
                <option value="">Selecione...</option>
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Objetivo pedagógico</label>
            <textarea value={pedagogicalGoal} onChange={e => setPedagogicalGoal(e.target.value)} rows={2} maxLength={500}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] transition resize-none" />
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
