import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

interface Piece {
  id: string
  title: string
  composer: string | null
  catalog_number: string | null
  period: string | null
  difficulty: number | null
  pedagogical_goal: string | null
  status: string
  completion_pct: number
  notes: string | null
}

interface ChecklistItem {
  id: string
  title: string
  category: string | null
  position: number
  is_optional: boolean
  completed: boolean
}

const periodLabel: Record<string, string> = {
  baroque: 'Barroco', classical: 'Clássico', romantic: 'Romântico',
  modern: 'Moderno', contemporary: 'Contemporâneo', popular: 'Popular', other: 'Outro',
}

const statusOptions = [
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'paused', label: 'Pausada' },
  { value: 'future', label: 'Repertório futuro' },
]

export default function PieceDetailPage() {
  const { studentId, pieceId } = useParams()

  const [piece, setPiece] = useState<Piece | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    if (pieceId && studentId) fetchAll()
  }, [pieceId, studentId])

  async function fetchAll() {
    const [pieceRes, checklistRes, completionsRes] = await Promise.all([
      supabase.from('pieces').select('*').eq('id', pieceId!).single(),
      supabase.from('checklist_items').select('*').eq('piece_id', pieceId!).order('position'),
      supabase.from('checklist_completions').select('checklist_item_id').eq('student_id',
        await getStudentId()
      ),
    ])

    const completedIds = new Set((completionsRes.data ?? []).map((c: { checklist_item_id: string }) => c.checklist_item_id))

    setPiece(pieceRes.data)
    setChecklist(
      (checklistRes.data ?? []).map((item: ChecklistItem) => ({
        ...item,
        completed: completedIds.has(item.id),
      }))
    )
    setLoading(false)
  }

  async function getStudentId() {
    return studentId!
  }

  async function toggleItem(item: ChecklistItem) {
    if (item.completed) {
      const { error } = await supabase
        .from('checklist_completions')
        .delete()
        .eq('checklist_item_id', item.id)
        .eq('student_id', studentId!)
      if (error) console.error('[checklist] delete error:', error.message)
    } else {
      const { error } = await supabase
        .from('checklist_completions')
        .insert({
          checklist_item_id: item.id,
          student_id: studentId!,
        })
      if (error) console.error('[checklist] insert error:', error.message)
    }

    // Atualiza local
    setChecklist(prev =>
      prev.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c)
    )

    // Atualiza % local otimisticamente
    const updated = checklist.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c)
    const mandatory = updated.filter(c => !c.is_optional)
    const completedMandatory = mandatory.filter(c => c.completed)
    const pct = mandatory.length > 0 ? Math.round((completedMandatory.length / mandatory.length) * 100) : 0
    setPiece(prev => prev ? { ...prev, completion_pct: pct } : prev)
  }

  async function addCustomItem() {
    if (!newItemTitle.trim()) return
    setAddingItem(true)

    const maxPosition = checklist.length > 0 ? Math.max(...checklist.map(c => c.position)) + 1 : 0

    const { data } = await supabase
      .from('checklist_items')
      .insert({
        piece_id: pieceId!,
        title: newItemTitle.trim(),
        category: 'Personalizado',
        position: maxPosition,
        is_default: false,
        is_optional: false,
      })
      .select()
      .single()

    if (data) {
      setChecklist(prev => [...prev, { ...data, completed: false }])
    }

    setNewItemTitle('')
    setAddingItem(false)
  }

  async function updateStatus(newStatus: string) {
    setSavingStatus(true)
    await supabase.from('pieces').update({ status: newStatus }).eq('id', pieceId!)
    setPiece(prev => prev ? { ...prev, status: newStatus } : prev)
    setSavingStatus(false)
  }

  async function deleteItem(itemId: string) {
    await supabase.from('checklist_items').delete().eq('id', itemId)
    setChecklist(prev => prev.filter(c => c.id !== itemId))
  }

  if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>
  if (!piece) return <TeacherLayout><p className="text-sm text-red-400">Peça não encontrada.</p></TeacherLayout>

  // Agrupa checklist por categoria
  const grouped = checklist.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const cat = item.category ?? 'Geral'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <TeacherLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}`} className="text-gray-400 hover:text-gray-600 transition">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E3A5F]">{piece.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {piece.composer ?? '—'}
            {piece.catalog_number && ` · ${piece.catalog_number}`}
            {piece.period && ` · ${periodLabel[piece.period] ?? piece.period}`}
          </p>
        </div>
      </div>

      {/* Progresso */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-600">Progresso</span>
          <span className="text-xl font-bold text-[#1E3A5F]">{piece.completion_pct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4A90C4] rounded-full transition-all duration-500"
            style={{ width: `${piece.completion_pct}%` }}
          />
        </div>

        {/* Status */}
        <div className="mt-4 space-y-1">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select value={piece.status} onChange={e => updateStatus(e.target.value)}
            disabled={savingStatus}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white">
            {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-600 mb-4">Checklist</h2>

        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{category}</p>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 group">
                    <button
                      onClick={() => toggleItem(item)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                        item.completed
                          ? 'bg-[#1E3A5F] border-[#1E3A5F]'
                          : 'border-gray-300 hover:border-[#4A90C4]'
                      }`}
                    >
                      {item.completed && (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>
                    <span className={`text-sm flex-1 ${item.completed ? 'line-through text-gray-300' : 'text-gray-700'} ${item.is_optional ? 'italic' : ''}`}>
                      {item.title}
                      {item.is_optional && <span className="text-xs text-gray-400 ml-1">(opcional)</span>}
                    </span>
                    {!item.is_optional && category === 'Personalizado' && (
                      <button onClick={() => deleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition text-xs">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Adicionar item personalizado */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Adicionar item personalizado</p>
          <div className="flex gap-2">
            <input
              value={newItemTitle}
              onChange={e => setNewItemTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomItem())}
              placeholder="Ex: Trabalhar digitação do compasso 12"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
            />
            <Button onClick={addCustomItem} disabled={addingItem || !newItemTitle.trim()}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs px-4">
              {addingItem ? '...' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Info da peça */}
      {(piece.notes || piece.difficulty) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-600">Detalhes</h2>
          {piece.difficulty && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-400">Dificuldade</span>
              <span className="text-xs font-medium text-gray-700">{piece.difficulty}/10</span>
            </div>
          )}
          {piece.notes && <p className="text-xs text-gray-600 leading-relaxed">{piece.notes}</p>}
        </div>
      )}
    </TeacherLayout>
  )
}