import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdMusicNote, MdNotes, MdTune, MdAdd, MdExpandMore, MdLibraryMusic, MdPiano, MdFavorite, MdGraphicEq, MdFlashOn, MdMic, MdFolder, MdBuild, MdStars, MdMenuBook, MdEmojiEvents } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'
import { DEFAULT_CHECKLIST } from '@/lib/defaultChecklist'

const PERIODS = [
  { value: 'baroque',      label: 'Barroco',       Icon: MdLibraryMusic, years: '1600–1750' },
  { value: 'classical',    label: 'Clássico',      Icon: MdPiano,        years: '1750–1820' },
  { value: 'romantic',     label: 'Romântico',     Icon: MdFavorite,     years: '1820–1900' },
  { value: 'modern',       label: 'Moderno',       Icon: MdGraphicEq,    years: '1900–1950' },
  { value: 'contemporary', label: 'Contemporâneo', Icon: MdFlashOn,      years: '1950–hoje' },
  { value: 'popular',      label: 'Popular',       Icon: MdMic,          years: 'folk · pop · jazz' },
  { value: 'other',        label: 'Outro',         Icon: MdFolder,       years: null },
]

const GOALS = [
  { value: 'technique',     label: 'Técnica',     Icon: MdBuild,       desc: 'Desenvolver habilidades técnicas e domínio do instrumento' },
  { value: 'performance',   label: 'Performance', Icon: MdStars,       desc: 'Preparar a peça para apresentação ao público' },
  { value: 'sight_reading', label: 'Leitura',     Icon: MdMenuBook,    desc: 'Exercitar leitura à primeira vista' },
  { value: 'recital',       label: 'Recital',     Icon: MdEmojiEvents, desc: 'Preparação específica para recital ou apresentação formal' },
  { value: 'other',         label: 'Outro',       Icon: MdFolder,      desc: '' },
]

const DIFFICULTIES = [
  { value: 3, label: 'Simples',     bars: 1, desc: 'Peça acessível, foco em fluência e musicalidade básica' },
  { value: 6, label: 'Normal',      bars: 2, desc: 'Desafio moderado com bom equilíbrio técnico e expressivo' },
  { value: 9, label: 'Desafiadora', bars: 3, desc: 'Alta exigência técnica ou grande demanda expressiva' },
]

const DEFAULT_ITEMS = () => DEFAULT_CHECKLIST.map((item, i) => ({ ...item, tempId: i }))

export default function NewPiecePage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  // ── Form fields ───────────────────────────────────────────────────────────
  const [title, setTitle]                     = useState('')
  const [composer, setComposer]               = useState('')
  const [catalogNumber, setCatalogNumber]     = useState('')
  const [period, setPeriod]                   = useState('')
  const [difficulty, setDifficulty]           = useState<number>(6)
  const [pedagogicalGoal, setPedagogicalGoal] = useState('')
  const [notes, setNotes]                     = useState('')

  // ── Checklist state ───────────────────────────────────────────────────────
  const [checklistItems, setChecklistItems] = useState(DEFAULT_ITEMS)
  const [checklistOpen, setChecklistOpen]   = useState(false)
  const [editingId, setEditingId]           = useState<number | null>(null)
  const [editingValue, setEditingValue]     = useState('')
  const [newItemTitle, setNewItemTitle]     = useState('')

  // ── Submit state ──────────────────────────────────────────────────────────
  const [keepCreating, setKeepCreating] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  // ── Checklist helpers ─────────────────────────────────────────────────────

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
    setTitle('')
    setComposer('')
    setCatalogNumber('')
    setPeriod('')
    setDifficulty(6)
    setPedagogicalGoal('')
    setNotes('')
    setChecklistItems(DEFAULT_ITEMS())
    setChecklistOpen(false)
    setEditingId(null)
    setNewItemTitle('')
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
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

      await supabase.from('checklist_items').insert(
        checklistItems.map((item, idx) => ({
          piece_id: piece.id,
          title: item.title,
          category: item.category,
          position: idx,
          is_default: false,
          is_optional: item.is_optional,
        }))
      )

      if (keepCreating) {
        resetForm()
        window.scrollTo({ top: 0, behavior: 'smooth' })
        toast.success('Peça criada! Formulário pronto para nova peça.')
      } else {
        toast.success('Peça criada!')
        navigate(`/professor/alunos/${studentId}/pecas/${piece.id}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Nova peça</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Identificação */}
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

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Período</label>
            <div className="grid grid-cols-3 gap-2">
              {PERIODS.map(p => {
                const active = period === p.value
                const Icon = p.Icon
                return (
                  <button key={p.value} type="button"
                    onClick={() => setPeriod(active ? '' : p.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition ${
                      p.value === 'other' ? 'col-span-3 border-dashed flex-row justify-center gap-2 py-2' : ''
                    } ${active ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'}`}>
                    <Icon size={p.value === 'other' ? 16 : 22} />
                    <span className="leading-none">{p.label}</span>
                    {p.years && <span className={`text-[10px] leading-none ${active ? 'text-white/60' : 'text-gray-400'} ${p.value === 'other' ? 'hidden' : ''}`}>{p.years}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Objetivo pedagógico</label>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(g => {
                const active = pedagogicalGoal === g.value
                const Icon = g.Icon
                return (
                  <button key={g.value} type="button"
                    title={g.desc || undefined}
                    onClick={() => setPedagogicalGoal(active ? '' : g.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition ${
                      g.value === 'other' ? 'col-span-2 border-dashed justify-center' : ''
                    } ${active ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'}`}>
                    <Icon size={18} />
                    <span>{g.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Dificuldade</label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map(d => {
                const active = difficulty === d.value
                return (
                  <button key={d.value} type="button"
                    title={d.desc}
                    onClick={() => setDifficulty(d.value)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition ${
                      active ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                    }`}>
                    <div className="flex gap-1">
                      {[1,2,3].map(bar => (
                        <div key={bar} className={`w-4 h-1.5 rounded-full transition ${
                          bar <= d.bars
                            ? active ? 'bg-white' : 'bg-[#4A90C4]'
                            : active ? 'bg-white/25' : 'bg-gray-200'
                        }`} />
                      ))}
                    </div>
                    <span className="text-xs font-semibold leading-none">{d.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 text-center">
              {DIFFICULTIES.find(d => d.value === difficulty)?.desc}
            </p>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdNotes size={15} /> Observações
          </h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Anotações sobre a peça..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
        </div>

        {/* Checklist colapsável */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setChecklistOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-100/60 transition"
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
              <MdTune size={15} /> Checklist
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{checklistItems.length} itens</span>
              <MdExpandMore
                size={18}
                className={`text-gray-400 transition-transform duration-200 ${checklistOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {checklistOpen && (
            <div className="px-5 pb-5 border-t border-gray-200">
              <div className="mt-3 space-y-1">
                {checklistItems.map(item => (
                  <div key={item.tempId} className="flex items-center gap-2 group py-1">
                    <div className="w-3.5 h-3.5 rounded border border-gray-300 shrink-0" />

                    {editingId === item.tempId ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => updateItem(item.tempId, editingValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); updateItem(item.tempId, editingValue) }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 px-2 py-0.5 text-xs rounded-md border border-[#4A90C4] outline-none bg-white"
                      />
                    ) : (
                      <span
                        onClick={() => { setEditingId(item.tempId); setEditingValue(item.title) }}
                        title="Clique para editar"
                        className={`flex-1 text-xs cursor-text select-none ${item.is_optional ? 'italic text-gray-400' : 'text-gray-600'}`}
                      >
                        {item.title}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleOptional(item.tempId)}
                      title={item.is_optional ? 'Marcar como obrigatório' : 'Marcar como opcional'}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 transition opacity-0 group-hover:opacity-100 ${
                        item.is_optional
                          ? 'bg-gray-200 text-gray-500'
                          : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      opt
                    </button>

                    <button
                      type="button"
                      onClick={() => removeItem(item.tempId)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition shrink-0 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                <input
                  value={newItemTitle}
                  onChange={e => setNewItemTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
                  placeholder="Adicionar item ao checklist..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#4A90C4] transition bg-white"
                />
                <button
                  type="button"
                  onClick={addItem}
                  className="px-3 py-1.5 rounded-lg bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/90 transition flex items-center"
                >
                  <MdAdd size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Continuar criando + botões */}
        <div className="space-y-3 pb-6">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepCreating}
              onChange={e => setKeepCreating(e.target.checked)}
              className="w-4 h-4 accent-[#4A90C4] rounded"
            />
            <span className="text-sm text-gray-500">Continuar criando</span>
          </label>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/professor/alunos/${studentId}`)}
              className="flex-1 rounded-xl border-gray-200 text-gray-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10"
            >
              {loading ? 'Criando...' : keepCreating ? 'Criar e continuar' : 'Criar peça'}
            </Button>
          </div>
        </div>

      </form>
    </TeacherLayout>
  )
}
