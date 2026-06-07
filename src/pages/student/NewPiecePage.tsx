import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdMusicNote, MdNotes, MdTune, MdAdd, MdExpandMore } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { StudentLayout } from '@/components/layout/StudentLayout'
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

const DEFAULT_ITEMS = () => DEFAULT_CHECKLIST.map((item, i) => ({ ...item, tempId: i }))

export default function StudentNewPiecePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState<string | null>(null)

  const [title, setTitle]                     = useState('')
  const [composer, setComposer]               = useState('')
  const [catalogNumber, setCatalogNumber]     = useState('')
  const [period, setPeriod]                   = useState('')
  const [difficulty, setDifficulty]           = useState<number>(5)
  const [pedagogicalGoal, setPedagogicalGoal] = useState('')
  const [notes, setNotes]                     = useState('')

  const [checklistItems, setChecklistItems] = useState(DEFAULT_ITEMS)
  const [checklistOpen, setChecklistOpen]   = useState(false)
  const [editingId, setEditingId]           = useState<number | null>(null)
  const [editingValue, setEditingValue]     = useState('')
  const [newItemTitle, setNewItemTitle]     = useState('')

  const [keepCreating, setKeepCreating] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  useEffect(() => {
    if (!profile) return
    supabase.from('students').select('id').eq('profile_id', profile.id).single()
      .then(({ data }) => { if (data) setStudentId(data.id) })
  }, [profile])

  function removeItem(tempId: number) {
    setChecklistItems(prev => prev.filter(i => i.tempId !== tempId))
  }

  function updateItem(tempId: number, newTitle: string) {
    const trimmed = newTitle.trim()
    setChecklistItems(prev =>
      prev.map(i => i.tempId === tempId ? { ...i, title: trimmed || i.title } : i)
    )
    setEditingId(null)
  }

  function toggleOptional(tempId: number) {
    setChecklistItems(prev =>
      prev.map(i => i.tempId === tempId ? { ...i, is_optional: !i.is_optional } : i)
    )
  }

  function addItem() {
    if (!newItemTitle.trim()) return
    setChecklistItems(prev => [...prev, {
      title: newItemTitle.trim(),
      category: 'Personalizado',
      position: prev.length,
      is_optional: false,
      tempId: Date.now(),
    }])
    setNewItemTitle('')
  }

  function resetForm() {
    setTitle(''); setComposer(''); setCatalogNumber(''); setPeriod('')
    setDifficulty(5); setPedagogicalGoal(''); setNotes('')
    setChecklistItems(DEFAULT_ITEMS()); setChecklistOpen(false)
    setEditingId(null); setNewItemTitle('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId) return
    setError(''); setLoading(true)
    try {
      const { data: piece, error: pieceError } = await supabase
        .from('pieces')
        .insert({
          student_id: studentId,
          title, composer: composer || null,
          catalog_number: catalogNumber || null,
          period: period || null, difficulty,
          pedagogical_goal: pedagogicalGoal || null,
          notes: notes || null, status: 'in_progress',
        })
        .select('id').single()

      if (pieceError || !piece) throw new Error('Erro ao criar peça.')

      await supabase.from('checklist_items').insert(
        checklistItems.map((item, idx) => ({
          piece_id: piece.id, title: item.title, category: item.category,
          position: idx, is_default: false, is_optional: item.is_optional,
        }))
      )

      if (keepCreating) {
        resetForm()
        window.scrollTo({ top: 0, behavior: 'smooth' })
        toast.success('Peça criada! Formulário pronto para nova peça.')
      } else {
        toast.success('Peça criada!')
        navigate(`/aluno/repertorio/pecas/${piece.id}`)
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
        <Link to="/aluno/repertorio?tab=pieces" className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Nova peça</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl mx-auto">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdMusicNote size={15} /> Identificação
          </h2>

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
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdNotes size={15} /> Observações
          </h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Anotações sobre a peça..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
        </div>

        <div className="bg-[#F5F7FA] rounded-2xl border border-gray-100 overflow-hidden">
          <button type="button" onClick={() => setChecklistOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-100/60 transition">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
              <MdTune size={15} /> Checklist
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{checklistItems.length} itens</span>
              <MdExpandMore size={18} className={`text-gray-400 transition-transform duration-200 ${checklistOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {checklistOpen && (
            <div className="px-5 pb-5 border-t border-gray-200">
              <div className="mt-3 space-y-1">
                {checklistItems.map(item => (
                  <div key={item.tempId} className="flex items-center gap-2 group py-1">
                    <div className="w-3.5 h-3.5 rounded border border-gray-300 shrink-0" />
                    {editingId === item.tempId ? (
                      <input autoFocus value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => updateItem(item.tempId, editingValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); updateItem(item.tempId, editingValue) }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 px-2 py-0.5 text-xs rounded-md border border-[#4A90C4] outline-none bg-white" />
                    ) : (
                      <span onClick={() => { setEditingId(item.tempId); setEditingValue(item.title) }}
                        title="Clique para editar"
                        className={`flex-1 text-xs cursor-text select-none ${item.is_optional ? 'italic text-gray-400' : 'text-gray-600'}`}>
                        {item.title}
                      </span>
                    )}
                    <button type="button" onClick={() => toggleOptional(item.tempId)}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 transition opacity-0 group-hover:opacity-100 ${
                        item.is_optional ? 'bg-gray-200 text-gray-500' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                      }`}>opt</button>
                    <button type="button" onClick={() => removeItem(item.tempId)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition shrink-0 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                <input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
                  placeholder="Adicionar item ao checklist..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#4A90C4] transition bg-white" />
                <button type="button" onClick={addItem}
                  className="px-3 py-1.5 rounded-lg bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/90 transition flex items-center">
                  <MdAdd size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="space-y-3 pb-6">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={keepCreating} onChange={e => setKeepCreating(e.target.checked)}
              className="w-4 h-4 accent-[#4A90C4] rounded" />
            <span className="text-sm text-gray-500">Continuar criando</span>
          </label>
          <div className="flex gap-3">
            <Button type="button" variant="outline"
              onClick={() => navigate('/aluno/repertorio?tab=pieces')}
              className="flex-1 rounded-xl border-gray-200 text-gray-600">Cancelar</Button>
            <Button type="submit" disabled={loading || !studentId}
              className="flex-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10">
              {loading ? 'Criando...' : keepCreating ? 'Criar e continuar' : 'Criar peça'}
            </Button>
          </div>
        </div>

      </form>
    </StudentLayout>
  )
}
