import { useState } from 'react'
import { MdAdd, MdExpandMore, MdTune } from 'react-icons/md'

export interface ChecklistEditorItem {
  tempId: number
  title: string
  category: string
  position: number
  is_optional: boolean
}

interface Props {
  items: ChecklistEditorItem[]
  onChange: (items: ChecklistEditorItem[]) => void
}

export function ChecklistEditor({ items, onChange }: Props) {
  const [open, setOpen]               = useState(false)
  const [editingId, setEditingId]     = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [newItemTitle, setNewItemTitle] = useState('')

  function removeItem(tempId: number) {
    onChange(items.filter(i => i.tempId !== tempId))
  }

  function updateItem(tempId: number, newTitle: string) {
    const trimmed = newTitle.trim()
    onChange(items.map(i => i.tempId === tempId ? { ...i, title: trimmed || i.title } : i))
    setEditingId(null)
  }

  function toggleOptional(tempId: number) {
    onChange(items.map(i => i.tempId === tempId ? { ...i, is_optional: !i.is_optional } : i))
  }

  function addItem() {
    if (!newItemTitle.trim()) return
    onChange([...items, {
      title: newItemTitle.trim(),
      category: 'Personalizado',
      position: items.length,
      is_optional: false,
      tempId: Date.now(),
    }])
    setNewItemTitle('')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-100/60 transition"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
          <MdTune size={15} /> Checklist
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{items.length} itens</span>
          <MdExpandMore
            size={18}
            className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-200">
          <div className="mt-3 space-y-1">
            {items.map(item => (
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
  )
}
