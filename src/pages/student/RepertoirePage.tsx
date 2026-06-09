import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Avatar from 'boring-avatars'
import { MdAdd, MdMusicNote, MdFitnessCenter, MdLibraryMusic } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { PROGRAM_TYPES } from '@/lib/programTypes'

const AVATAR_COLORS = ['#1E3A5F', '#4A90C4', '#D6E4F0', '#F5F7FA', '#FFFFFF']

interface ChecklistItem {
  id: string; title: string; category: string | null; position: number; is_optional: boolean
}

interface Piece {
  id: string; title: string; composer: string | null; status: string
  completion_pct: number; checklist_items: ChecklistItem[]
}

interface Exercise {
  id: string; title: string; category: string; status: string
}

interface Programa {
  id: string; title: string; type: string; status: string; deadline: string | null
}

const pieceStatusLabel: Record<string, string> = {
  in_progress: 'Em andamento', completed: 'Concluída', paused: 'Pausada', future: 'Repertório futuro',
}

const categoryLabel: Record<string, string> = {
  technique: 'Técnica', ear_training: 'Percepção musical', harmony: 'Harmonia',
  history: 'História da música', improvisation: 'Improvisação', other: 'Outro',
}

const exerciseStatusLabel: Record<string, string> = {
  active: 'Ativo', inactive: 'Inativo', completed: 'Concluído',
}

const typeLabel: Record<string, string> = {
  regular: 'Aulas Regulares', recital: 'Recital', concerto: 'Concerto', show: 'Show',
  gravacao: 'Gravação', exame: 'Exame', participacao: 'Participação', outro: 'Outro',
}

function daysUntil(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(date + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

type TabKey = 'pieces' | 'exercises' | 'programs'

export default function RepertoirePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab') as TabKey | null
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam === 'exercises' || tabParam === 'programs' ? tabParam : 'pieces'
  )

  const [pieces, setPieces] = useState<Piece[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [programas, setProgramas] = useState<Programa[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null)

  function switchTab(tab: TabKey) {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  useEffect(() => {
    if (profile) fetchAll()
  }, [profile])

  async function fetchAll() {
    const { data: student, error: studentError } = await supabase
      .from('students').select('id').eq('profile_id', profile!.id).single()

    if (studentError || !student) {
      console.error('[RepertoirePage] student fetch failed:', studentError)
      setFetchError('Não foi possível carregar seu repertório. Tente recarregar a página.')
      setLoading(false)
      return
    }

    const [piecesRes, exercisesRes, completionsRes, programasRes] = await Promise.all([
      supabase.from('pieces')
        .select('id, title, composer, status, completion_pct, checklist_items(id, title, category, position, is_optional)')
        .eq('student_id', student.id).order('title'),
      supabase.from('exercises')
        .select('id, title, category, status').eq('student_id', student.id).order('title'),
      supabase.from('checklist_completions')
        .select('checklist_item_id').eq('student_id', student.id),
      supabase.from('programas')
        .select('id, title, type, status, deadline').eq('student_id', student.id).order('title'),
    ])

    if (piecesRes.error || exercisesRes.error) {
      console.error('[RepertoirePage] fetch failed:', piecesRes.error ?? exercisesRes.error)
      setFetchError('Não foi possível carregar o repertório. Tente recarregar a página.')
      setLoading(false)
      return
    }

    setPieces(
      (piecesRes.data ?? []).map((p: Piece) => ({
        ...p,
        checklist_items: (p.checklist_items ?? []).sort(
          (a: ChecklistItem, b: ChecklistItem) => a.position - b.position
        ),
      }))
    )
    setExercises(exercisesRes.data ?? [])
    setCompletedIds(new Set((completionsRes.data ?? []).map((c: { checklist_item_id: string }) => c.checklist_item_id)))
    setProgramas(programasRes.data ?? [])
    setLoading(false)
  }

  if (loading) {
    return <StudentLayout><div className="flex justify-center py-12"><Spinner /></div></StudentLayout>
  }

  if (fetchError) {
    return <StudentLayout><p className="text-sm text-red-500 text-center py-12">{fetchError}</p></StudentLayout>
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
          { key: 'pieces' as TabKey,    label: `Peças (${pieces.length})` },
          { key: 'exercises' as TabKey, label: `Exercícios (${exercises.length})` },
          { key: 'programs' as TabKey,  label: `Programas (${programas.length})` },
        ]).map(tab => (
          <button key={tab.key} onClick={() => switchTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === tab.key ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Peças */}
      {activeTab === 'pieces' && (
        <div className="space-y-3">
          {pieces.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdMusicNote size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Nenhuma peça cadastrada</p>
              <p className="text-xs text-gray-400 mt-1">Adicione sua primeira peça!</p>
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
                  <div className="flex items-center gap-4 px-5 py-4">
                    <button onClick={() => navigate(`/aluno/repertorio/pecas/${piece.id}`)}
                      className="relative w-10 h-10 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90 absolute inset-0">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="#F3F4F6" strokeWidth="3"/>
                        <circle cx="18" cy="18" r="15" fill="none" stroke="#4A90C4" strokeWidth="3"
                          strokeDasharray={`${(piece.completion_pct / 100) * 94.2} 94.2`}
                          strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full overflow-hidden">
                          <Avatar size={24} name={piece.title} variant="marble" colors={AVATAR_COLORS} />
                        </div>
                      </div>
                    </button>

                    <button onClick={() => navigate(`/aluno/repertorio/pecas/${piece.id}`)}
                      className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-gray-800 truncate">{piece.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {piece.composer ?? '—'} · {pieceStatusLabel[piece.status] ?? piece.status}
                      </p>
                    </button>

                    <button onClick={() => setExpandedPieceId(isExpanded ? null : piece.id)}
                      className="shrink-0 text-gray-400 hover:text-gray-600 transition p-1">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  </div>

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
                                      completedIds.has(item.id) ? 'bg-[#1E3A5F] border-[#1E3A5F]' : 'border-gray-300'
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
          <div className="flex flex-col items-center gap-2 pt-4 pb-2">
            <button onClick={() => navigate('/aluno/repertorio/pecas/nova')}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition">
              <MdAdd size={18} />Nova peça
            </button>
            <button className="text-xs text-gray-400 hover:text-gray-600 transition">
              ou clique para importar em lote
            </button>
          </div>
        </div>
      )}

      {/* Tab: Exercícios */}
      {activeTab === 'exercises' && (
        <div className="space-y-3">
          {exercises.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdFitnessCenter size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Nenhum exercício cadastrado</p>
              <p className="text-xs text-gray-400 mt-1">Adicione seu primeiro exercício!</p>
            </div>
          ) : (
            exercises.map(ex => (
              <button key={ex.id} onClick={() => navigate(`/aluno/repertorio/exercicios/${ex.id}`)}
                className="w-full bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#4A90C4]/40 transition text-left">
                <div className="shrink-0 rounded-lg overflow-hidden">
                  <Avatar size={36} name={ex.title} variant="pixel" colors={AVATAR_COLORS} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{ex.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {categoryLabel[ex.category] ?? ex.category} · {exerciseStatusLabel[ex.status] ?? ex.status}
                  </p>
                </div>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))
          )}
          <div className="flex flex-col items-center gap-2 pt-4 pb-2">
            <button onClick={() => navigate('/aluno/repertorio/exercicios/novo')}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition">
              <MdAdd size={18} />Novo exercício
            </button>
            <button className="text-xs text-gray-400 hover:text-gray-600 transition">
              ou clique para importar em lote
            </button>
          </div>
        </div>
      )}

      {/* Tab: Programas */}
      {activeTab === 'programs' && (
        <div className="space-y-3">
          {programas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdLibraryMusic size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Nenhum programa cadastrado</p>
              <p className="text-xs text-gray-400 mt-1">Crie seu primeiro programa!</p>
            </div>
          ) : (
            programas.map(prog => {
              const days = prog.deadline ? daysUntil(prog.deadline) : null
              const ProgIcon = (PROGRAM_TYPES[prog.type] ?? PROGRAM_TYPES.outro).Icon
              return (
                <button key={prog.id} onClick={() => navigate(`/aluno/repertorio/programas/${prog.id}`)}
                  className="w-full bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#4A90C4]/40 transition text-left">
                  <div className="w-9 h-9 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                    <ProgIcon size={18} color="white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{prog.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {typeLabel[prog.type] ?? prog.type}
                      {prog.status === 'archived' && ' · Arquivado'}
                    </p>
                  </div>
                  {days !== null && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      days < 0  ? 'bg-gray-100 text-gray-400' :
                      days < 14 ? 'bg-red-50 text-red-500' :
                      days < 30 ? 'bg-amber-50 text-amber-600' :
                                  'bg-green-50 text-green-600'
                    }`}>
                      {days < 0 ? 'passou' : days === 0 ? 'hoje' : `${days}d`}
                    </span>
                  )}
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              )
            })
          )}
          <button onClick={() => navigate('/aluno/repertorio/programas/novo')}
            className="flex items-center justify-center gap-2 w-full py-24 text-xl font-medium text-gray-300 hover:text-[#1E3A5F] transition">
            <MdAdd size={22} />Novo programa
          </button>
        </div>
      )}
    </StudentLayout>
  )
}
