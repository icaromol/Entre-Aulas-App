import { useEffect, useState } from 'react'
import Avatar from 'boring-avatars'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { StudentLayout } from '@/components/layout/StudentLayout'

const AVATAR_COLORS = ['#1E3A5F', '#4A90C4', '#D6E4F0', '#F5F7FA', '#FFFFFF']

interface ChecklistItem {
  id: string
  title: string
  category: string | null
  position: number
  is_optional: boolean
}

interface Piece {
  id: string
  title: string
  composer: string | null
  status: string
  completion_pct: number
  checklist_items: ChecklistItem[]
}

interface Exercise {
  id: string
  title: string
  category: string
  status: string
}

const pieceStatusLabel: Record<string, string> = {
  in_progress: 'Em andamento',
  completed: 'Concluída',
  paused: 'Pausada',
  future: 'Repertório futuro',
}

const categoryLabel: Record<string, string> = {
  technique: 'Técnica',
  ear_training: 'Percepção musical',
  harmony: 'Harmonia',
  history: 'História da música',
  improvisation: 'Improvisação',
  other: 'Outro',
}

const exerciseStatusLabel: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  completed: 'Concluído',
}

export default function RepertoirePage() {
  const { profile } = useAuth()

  const [pieces, setPieces] = useState<Piece[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pieces' | 'exercises'>('pieces')
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null)

  useEffect(() => {
    if (profile) fetchAll()
  }, [profile])

  async function fetchAll() {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()

    if (!student) { setLoading(false); return }

    const [piecesRes, exercisesRes, completionsRes] = await Promise.all([
      supabase
        .from('pieces')
        .select('id, title, composer, status, completion_pct, checklist_items(id, title, category, position, is_optional)')
        .eq('student_id', student.id)
        .order('title'),
      supabase
        .from('exercises')
        .select('id, title, category, status')
        .eq('student_id', student.id)
        .order('title'),
      supabase
        .from('checklist_completions')
        .select('checklist_item_id')
        .eq('student_id', student.id),
    ])

    setPieces(
      (piecesRes.data ?? []).map((p: Piece) => ({
        ...p,
        checklist_items: (p.checklist_items ?? []).sort(
          (a: ChecklistItem, b: ChecklistItem) => a.position - b.position
        ),
      }))
    )
    setExercises(exercisesRes.data ?? [])
    setCompletedIds(
      new Set((completionsRes.data ?? []).map((c: { checklist_item_id: string }) => c.checklist_item_id))
    )
    setLoading(false)
  }

  if (loading) {
    return (
      <StudentLayout>
        <p className="text-sm text-gray-400">Carregando...</p>
      </StudentLayout>
    )
  }

  return (
    <StudentLayout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1E3A5F]">Repertório</h1>
        <p className="text-sm text-gray-400 mt-0.5">Seu material de estudo</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {([
          { key: 'pieces', label: `Peças (${pieces.length})` },
          { key: 'exercises', label: `Exercícios (${exercises.length})` },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === tab.key
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Peças */}
      {activeTab === 'pieces' && (
        <div className="space-y-3">
          {pieces.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <p className="text-4xl mb-3">🎼</p>
              <p className="text-sm font-semibold text-gray-600">Nenhuma peça cadastrada</p>
              <p className="text-xs text-gray-400 mt-1">Seu professor ainda não adicionou peças.</p>
            </div>
          ) : (
            pieces.map(piece => {
              const isExpanded = expandedPieceId === piece.id
              const grouped = piece.checklist_items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
                const cat = item.category ?? 'Geral'
                if (!acc[cat]) acc[cat] = []
                acc[cat].push(item)
                return acc
              }, {})

              return (
                <div key={piece.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setExpandedPieceId(isExpanded ? null : piece.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50 transition"
                  >
                    {/* Círculo de progresso */}
                    <div className="relative w-10 h-10 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90 absolute inset-0">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="#F3F4F6" strokeWidth="3"/>
                        <circle
                          cx="18" cy="18" r="15" fill="none"
                          stroke="#4A90C4" strokeWidth="3"
                          strokeDasharray={`${(piece.completion_pct / 100) * 94.2} 94.2`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full overflow-hidden">
                          <Avatar size={24} name={piece.title} variant="marble" colors={AVATAR_COLORS} />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{piece.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {piece.composer ?? '—'} · {pieceStatusLabel[piece.status] ?? piece.status}
                      </p>
                    </div>

                    <svg
                      width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2}
                      className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>

                  {/* Checklist expandida */}
                  {isExpanded && (
                    <div className="px-5 pb-4 border-t border-gray-100">
                      {piece.checklist_items.length === 0 ? (
                        <p className="text-xs text-gray-400 pt-3">Nenhum item no checklist.</p>
                      ) : (
                        <div className="space-y-4 pt-3">
                          {Object.entries(grouped).map(([category, items]) => (
                            <div key={category}>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{category}</p>
                              <div className="space-y-2">
                                {items.map(item => (
                                  <div key={item.id} className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                      completedIds.has(item.id)
                                        ? 'bg-[#1E3A5F] border-[#1E3A5F]'
                                        : 'border-gray-300'
                                    }`}>
                                      {completedIds.has(item.id) && (
                                        <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                          <path d="M5 13l4 4L19 7"/>
                                        </svg>
                                      )}
                                    </div>
                                    <span className={`text-xs flex-1 ${completedIds.has(item.id) ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                                      {item.title}
                                      {item.is_optional && <span className="text-gray-400 ml-1">(opcional)</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Exercícios */}
      {activeTab === 'exercises' && (
        <div className="space-y-3">
          {exercises.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <p className="text-4xl mb-3">🎹</p>
              <p className="text-sm font-semibold text-gray-600">Nenhum exercício cadastrado</p>
              <p className="text-xs text-gray-400 mt-1">Seu professor ainda não adicionou exercícios.</p>
            </div>
          ) : (
            exercises.map(ex => (
              <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
                <div className="shrink-0 rounded-lg overflow-hidden">
                  <Avatar size={36} name={ex.title} variant="pixel" colors={AVATAR_COLORS} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{ex.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {categoryLabel[ex.category] ?? ex.category} · {exerciseStatusLabel[ex.status] ?? ex.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </StudentLayout>
  )
}
