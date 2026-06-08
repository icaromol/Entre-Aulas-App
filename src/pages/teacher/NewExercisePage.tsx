import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdSchool, MdNotes, MdAdd, MdExpandMore } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

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

const DEFAULT_ITEMS = () => DEFAULT_EXERCISE_CHECKLIST.map((item, i) => ({ ...item, tempId: i }))

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
    setCategory('technique')
    setObjective('')
    setDifficulty(5)
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

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}?tab=repertoire`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Novo exercício</h1>
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
            <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2} maxLength={500}
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

        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdNotes size={15} /> Observações
          </h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000}
            placeholder="Anotações sobre o exercício..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
        </div>

        {/* Checklist colapsável */}
        <div className="bg-[#F5F7FA] rounded-2xl border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setChecklistOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-100/60 transition"
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
              Checklist
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
              onClick={() => navigate(`/professor/alunos/${studentId}?tab=repertoire`)}
              className="flex-1 rounded-xl border-gray-200 text-gray-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10"
            >
              {loading ? 'Criando...' : keepCreating ? 'Criar e continuar' : 'Criar exercício'}
            </Button>
          </div>
        </div>

      </form>
    </TeacherLayout>
  )
}
