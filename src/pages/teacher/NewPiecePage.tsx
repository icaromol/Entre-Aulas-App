import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'
import { DEFAULT_CHECKLIST } from '@/lib/defaultChecklist'

const PERIODS = [
  { value: 'baroque', label: 'Barroco' },
  { value: 'classical', label: 'Clássico' },
  { value: 'romantic', label: 'Romântico' },
  { value: 'modern', label: 'Moderno' },
  { value: 'contemporary', label: 'Contemporâneo' },
  { value: 'popular', label: 'Popular' },
  { value: 'other', label: 'Outro' },
]

const GOALS = [
  { value: 'technique', label: 'Técnica' },
  { value: 'performance', label: 'Performance' },
  { value: 'sight_reading', label: 'Leitura' },
  { value: 'recital', label: 'Recital' },
  { value: 'other', label: 'Outro' },
]

export default function NewPiecePage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [catalogNumber, setCatalogNumber] = useState('')
  const [period, setPeriod] = useState('')
  const [difficulty, setDifficulty] = useState<number>(5)
  const [pedagogicalGoal, setPedagogicalGoal] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Cria a peça
      const { data: piece, error: pieceError } = await supabase
        .from('pieces')
        .insert({
          student_id: studentId!,
          title,
          composer: composer || null,
          catalog_number: catalogNumber || null,
          period: period || null,
          difficulty,
          pedagogical_goal: pedagogicalGoal || null,
          notes: notes || null,
          status: 'in_progress',
        })
        .select('id')
        .single()

      if (pieceError || !piece) throw new Error('Erro ao criar peça.')

      // 2. Gera checklist padrão
      const checklistRows = DEFAULT_CHECKLIST.map(item => ({
        piece_id: piece.id,
        title: item.title,
        category: item.category,
        position: item.position,
        is_default: true,
        is_optional: item.is_optional,
      }))

      await supabase.from('checklist_items').insert(checklistRows)

      navigate(`/professor/alunos/${studentId}/pecas/${piece.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}`} className="text-gray-400 hover:text-gray-600 transition">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Nova peça</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-600">Identificação</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Título da peça</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Ex: Sonatina Op.36 nº1"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Compositor</label>
              <input value={composer} onChange={e => setComposer(e.target.value)}
                placeholder="Ex: Clementi"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Opus / Catálogo</label>
              <input value={catalogNumber} onChange={e => setCatalogNumber(e.target.value)}
                placeholder="Ex: Op.36, BWV 772"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Período</label>
              <select value={period} onChange={e => setPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white">
                <option value="">Selecione...</option>
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Objetivo pedagógico</label>
              <select value={pedagogicalGoal} onChange={e => setPedagogicalGoal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white">
                <option value="">Selecione...</option>
                {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
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
            <div className="flex justify-between text-[10px] text-gray-300">
              <span>Fácil</span><span>Difícil</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-gray-600">Observações</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Anotações sobre a peça..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
        </div>

        {/* Preview da checklist */}
        <div className="bg-[#F5F7FA] rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">
            Checklist gerada automaticamente
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            {DEFAULT_CHECKLIST.filter(i => !i.is_optional).length} itens obrigatórios
            · {DEFAULT_CHECKLIST.filter(i => i.is_optional).length} opcional
          </p>
          <div className="space-y-1.5">
            {DEFAULT_CHECKLIST.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded border border-gray-300 shrink-0" />
                <span className={`text-xs ${item.is_optional ? 'text-gray-400 italic' : 'text-gray-600'}`}>
                  {item.title} {item.is_optional && '(opcional)'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" disabled={loading}
          className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10">
          {loading ? 'Criando peça...' : 'Criar peça com checklist'}
        </Button>

      </form>
    </TeacherLayout>
  )
}