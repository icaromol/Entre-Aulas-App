import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdArrowBack, MdAdd, MdDeleteOutline, MdEdit, MdMusicNote, MdSchool,
  MdCalendarMonth, MdLocationOn, MdArchive, MdClose, MdSave,
} from 'react-icons/md'
import Avatar from 'boring-avatars'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { PROGRAM_TYPES } from '@/lib/programTypes'
import type { Programa, ProgramPiece, ProgramExercise } from '@/types/programs'

const AVATAR_COLORS = ['#1E3A5F', '#4A90C4', '#D6E4F0', '#F5F7FA', '#FFFFFF']

const typeLabel: Record<string, string> = {
  recital: 'Apresentação', concerto: 'Apresentação', show: 'Apresentação', participacao: 'Apresentação',
  gravacao: 'Gravação', exame: 'Exame', outro: 'Outro',
}

const exerciseCategoryLabel: Record<string, string> = {
  technique: 'Técnica', ear_training: 'Percepção', harmony: 'Harmonia',
  history: 'História', improvisation: 'Improvisação', other: 'Outro',
}

interface AvailablePiece { id: string; title: string; composer: string | null; completion_pct: number; difficulty: number | null }
interface AvailableExercise { id: string; title: string; category: string; difficulty: number | null }

function formatDeadline(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function daysUntil(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(date + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function StudentProgramaDetailPage() {
  const { programId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState<string | null>(null)
  const [programa, setPrograma] = useState<Programa | null>(null)
  const [programPieces, setProgramPieces] = useState<ProgramPiece[]>([])
  const [programExercises, setProgramExercises] = useState<ProgramExercise[]>([])
  const [loading, setLoading] = useState(true)

  const [showPiecePicker, setShowPiecePicker] = useState(false)
  const [availablePieces, setAvailablePieces] = useState<AvailablePiece[]>([])
  const [addingPieceId, setAddingPieceId] = useState<string | null>(null)

  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [availableExercises, setAvailableExercises] = useState<AvailableExercise[]>([])
  const [addingExerciseId, setAddingExerciseId] = useState<string | null>(null)

  // weights: keyed by program_pieces/program_exercises id; value 1–5
  const [pieceWeights, setPieceWeights] = useState<Record<string, number>>({})
  const [exerciseWeights, setExerciseWeights] = useState<Record<string, number>>({})
  const [savingWeights, setSavingWeights] = useState(false)
  const weightsChanged = useRef(false)

  useEffect(() => {
    if (!profile) return
    supabase.from('students').select('id').eq('profile_id', profile.id).single()
      .then(({ data }) => { if (data) setStudentId(data.id) })
  }, [profile])

  useEffect(() => {
    if (programId && studentId) fetchAll()
  }, [programId, studentId])

  async function fetchAll() {
    const [programaRes, piecesRes, exercisesRes] = await Promise.all([
      supabase.from('programas').select('*').eq('id', programId!).single(),
      supabase.from('program_pieces').select(`
        id, program_id, piece_id, priority_override,
        piece:pieces(id, title, composer, completion_pct, difficulty)
      `).eq('program_id', programId!),
      supabase.from('program_exercises').select(`
        id, program_id, exercise_id, priority_override,
        exercise:exercises(id, title, category, difficulty)
      `).eq('program_id', programId!),
    ])
    setPrograma(programaRes.data)
    const pieces = (piecesRes.data ?? []) as unknown as ProgramPiece[]
    const exercises = (exercisesRes.data ?? []) as unknown as ProgramExercise[]
    setProgramPieces(pieces)
    setProgramExercises(exercises)
    setPieceWeights(Object.fromEntries(pieces.map(pp => [pp.id, pp.priority_override ?? 3])))
    setExerciseWeights(Object.fromEntries(exercises.map(pe => [pe.id, pe.priority_override ?? 3])))
    weightsChanged.current = false
    setLoading(false)
  }

  async function openPiecePicker() {
    if (!studentId) return
    const linkedIds = programPieces.map(pp => pp.piece_id)
    const { data } = await supabase.from('pieces').select('id, title, composer, completion_pct, difficulty')
      .eq('student_id', studentId).order('title')
    setAvailablePieces((data ?? []).filter(p => !linkedIds.includes(p.id)))
    setShowPiecePicker(true)
  }

  async function addPiece(pieceId: string) {
    setAddingPieceId(pieceId)
    const { data } = await supabase.from('program_pieces')
      .insert({ program_id: programId!, piece_id: pieceId, priority_override: 3 })
      .select('id, program_id, piece_id, priority_override, piece:pieces(id, title, composer, completion_pct, difficulty)')
      .single()
    if (data) {
      const pp = data as unknown as ProgramPiece
      setProgramPieces(prev => [...prev, pp])
      setPieceWeights(prev => ({ ...prev, [pp.id]: pp.priority_override ?? 3 }))
      setAvailablePieces(prev => prev.filter(p => p.id !== pieceId))
      toast.success('Peça adicionada ao objetivo')
    }
    setAddingPieceId(null)
  }

  async function removePiece(pp: ProgramPiece) {
    await supabase.from('program_pieces').delete().eq('id', pp.id)
    setProgramPieces(prev => prev.filter(p => p.id !== pp.id))
    setPieceWeights(prev => { const n = { ...prev }; delete n[pp.id]; return n })
    if (pp.piece) setAvailablePieces(prev => [...prev, pp.piece as AvailablePiece])
  }

  async function openExercisePicker() {
    if (!studentId) return
    const linkedIds = programExercises.map(pe => pe.exercise_id)
    const { data } = await supabase.from('exercises').select('id, title, category, difficulty')
      .eq('student_id', studentId).order('title')
    setAvailableExercises((data ?? []).filter(e => !linkedIds.includes(e.id)))
    setShowExercisePicker(true)
  }

  async function addExercise(exerciseId: string) {
    setAddingExerciseId(exerciseId)
    const { data } = await supabase.from('program_exercises')
      .insert({ program_id: programId!, exercise_id: exerciseId, priority_override: 3 })
      .select('id, program_id, exercise_id, priority_override, exercise:exercises(id, title, category, difficulty)')
      .single()
    if (data) {
      const pe = data as unknown as ProgramExercise
      setProgramExercises(prev => [...prev, pe])
      setExerciseWeights(prev => ({ ...prev, [pe.id]: pe.priority_override ?? 3 }))
      setAvailableExercises(prev => prev.filter(e => e.id !== exerciseId))
      toast.success('Exercício adicionado ao objetivo')
    }
    setAddingExerciseId(null)
  }

  async function removeExercise(pe: ProgramExercise) {
    await supabase.from('program_exercises').delete().eq('id', pe.id)
    setProgramExercises(prev => prev.filter(p => p.id !== pe.id))
    setExerciseWeights(prev => { const n = { ...prev }; delete n[pe.id]; return n })
    if (pe.exercise) setAvailableExercises(prev => [...prev, pe.exercise as AvailableExercise])
  }

  async function saveWeights() {
    setSavingWeights(true)
    const pieceUpdates = programPieces.map(pp =>
      supabase.from('program_pieces').update({ priority_override: pieceWeights[pp.id] ?? 3 }).eq('id', pp.id)
    )
    const exerciseUpdates = programExercises.map(pe =>
      supabase.from('program_exercises').update({ priority_override: exerciseWeights[pe.id] ?? 3 }).eq('id', pe.id)
    )
    await Promise.all([...pieceUpdates, ...exerciseUpdates])
    weightsChanged.current = false
    setSavingWeights(false)
    toast.success('Pesos salvos!')
  }

  async function archivePrograma() {
    if (!confirm('Arquivar este objetivo? Ele deixará de aparecer na lista ativa.')) return
    await supabase.from('programas').update({ status: 'archived' }).eq('id', programId!)
    setPrograma(prev => prev ? { ...prev, status: 'archived' } : prev)
    toast.success('Objetivo arquivado')
  }

  async function deletePrograma() {
    if (!confirm('Excluir permanentemente este objetivo? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from('programas').delete().eq('id', programId!)
    if (error) { toast.error('Erro ao excluir objetivo.'); return }
    toast.success('Objetivo excluído')
    navigate('/aluno/objetivos')
  }

  if (!isValidUUID(programId)) return <Navigate to="/" replace />
  if (loading) return <StudentLayout><div className="flex justify-center py-12"><Spinner /></div></StudentLayout>
  if (!programa) return <StudentLayout><p className="text-sm text-red-400">Objetivo não encontrado.</p></StudentLayout>

  const days = programa.deadline ? daysUntil(programa.deadline) : null
  const ProgramaIcon = (PROGRAM_TYPES[programa.type] ?? PROGRAM_TYPES.outro).Icon

  const Picker = ({ show, title: pickerTitle, items, addingId, onAdd, onClose, renderItem }: {
    show: boolean; title: string; items: { id: string; title: string }[]
    addingId: string | null; onAdd: (id: string) => void; onClose: () => void
    renderItem: (item: { id: string; title: string }) => React.ReactNode
  }) => show ? (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={onClose}>
      <div className="bg-white rounded-t-2xl p-5 w-full max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#1E3A5F]">{pickerTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <MdClose size={20} />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Tudo já está no objetivo.</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <button key={item.id} onClick={() => onAdd(item.id)} disabled={addingId === item.id}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#4A90C4] transition text-left disabled:opacity-50">
                {renderItem(item)}
                <span className="text-xs text-[#4A90C4] font-medium shrink-0">
                  {addingId === item.id ? '...' : '+ Adicionar'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <StudentLayout>
      <Picker show={showPiecePicker} title="Adicionar peça" items={availablePieces}
        addingId={addingPieceId} onAdd={addPiece} onClose={() => setShowPiecePicker(false)}
        renderItem={item => {
          const p = item as AvailablePiece
          return (
            <>
              <div className="shrink-0 rounded-full overflow-hidden">
                <Avatar size={32} name={p.title} variant="marble" colors={AVATAR_COLORS} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                <p className="text-xs text-gray-400">{p.composer ?? '—'} · {p.completion_pct}%</p>
              </div>
            </>
          )
        }}
      />

      <Picker show={showExercisePicker} title="Adicionar exercício" items={availableExercises}
        addingId={addingExerciseId} onAdd={addExercise} onClose={() => setShowExercisePicker(false)}
        renderItem={item => {
          const ex = item as AvailableExercise
          return (
            <>
              <div className="shrink-0 rounded-lg overflow-hidden">
                <Avatar size={32} name={ex.title} variant="pixel" colors={AVATAR_COLORS} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{ex.title}</p>
                <p className="text-xs text-gray-400">{exerciseCategoryLabel[ex.category] ?? ex.category}</p>
              </div>
            </>
          )
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/aluno/objetivos" className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F] flex items-center justify-center shrink-0">
          <ProgramaIcon size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[#1E3A5F] truncate">{programa.title}</h1>
          {programa.status === 'archived' && (
            <span className="text-xs text-gray-400">Arquivado</span>
          )}
        </div>
        <Link to={`/aluno/repertorio/programas/${programId}/editar`} className="text-gray-400 hover:text-[#4A90C4] transition shrink-0">
          <MdEdit size={20} />
        </Link>
      </div>

      {/* Data e local */}
      {(programa.deadline || programa.venue) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 space-y-2">
          {programa.deadline && (
            <div className="flex items-center gap-2">
              <MdCalendarMonth size={16} className="text-[#4A90C4] shrink-0" />
              <span className="text-sm text-gray-700">{formatDeadline(programa.deadline)}</span>
              {days !== null && (
                <span className={`text-xs font-semibold ml-auto px-2 py-0.5 rounded-full ${
                  days < 0  ? 'bg-gray-100 text-gray-400' :
                  days < 14 ? 'bg-red-50 text-red-500' :
                  days < 30 ? 'bg-amber-50 text-amber-600' :
                              'bg-green-50 text-green-600'
                }`}>
                  {days < 0 ? 'passou' : days === 0 ? 'hoje' : `em ${days} dias`}
                </span>
              )}
            </div>
          )}
          {programa.venue && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MdLocationOn size={16} className="text-gray-400 shrink-0" />{programa.venue}
            </div>
          )}
        </div>
      )}

      {/* Tipo — badge apenas se não for regular */}
      {programa.type !== 'regular' && typeLabel[programa.type] && (
        <div className="mb-4">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#D6E4F0] text-[#1E3A5F]">
            {typeLabel[programa.type]}
          </span>
        </div>
      )}

      {programa.type !== 'regular' && (
        <>
          {/* Peças */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                <MdMusicNote size={15} />Peças ({programPieces.length})
              </h2>
              <button onClick={openPiecePicker}
                className="flex items-center gap-1 text-xs font-medium text-[#4A90C4] hover:text-[#1E3A5F] transition">
                <MdAdd size={16} />Adicionar peça
              </button>
            </div>
            {programPieces.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhuma peça vinculada ainda.</p>
            ) : (
              <div className="space-y-4">
                {programPieces.map(pp => (
                  <div key={pp.id} className="group">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90 absolute inset-0">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="#F3F4F6" strokeWidth="3"/>
                          <circle cx="18" cy="18" r="15" fill="none" stroke="#4A90C4" strokeWidth="3"
                            strokeDasharray={`${((pp.piece?.completion_pct ?? 0) / 100) * 94.2} 94.2`}
                            strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full overflow-hidden">
                            <Avatar size={22} name={pp.piece?.title ?? ''} variant="marble" colors={AVATAR_COLORS} />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{pp.piece?.title}</p>
                        <p className="text-xs text-gray-400">{pp.piece?.composer ?? '—'} · {pp.piece?.completion_pct ?? 0}%</p>
                      </div>
                      <button onClick={() => removePiece(pp)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition">
                        <MdDeleteOutline size={18} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pl-12">
                      <span className="text-[10px] text-gray-400 w-14 shrink-0">Importância</span>
                      <input type="range" min={1} max={5} step={1}
                        value={pieceWeights[pp.id] ?? 3}
                        onChange={e => {
                          weightsChanged.current = true
                          setPieceWeights(prev => ({ ...prev, [pp.id]: Number(e.target.value) }))
                        }}
                        className="flex-1 accent-[#1E3A5F] h-1.5 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-[#1E3A5F] w-4 text-center shrink-0">
                        {pieceWeights[pp.id] ?? 3}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Exercícios */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                <MdSchool size={15} />Exercícios ({programExercises.length})
              </h2>
              <button onClick={openExercisePicker}
                className="flex items-center gap-1 text-xs font-medium text-[#4A90C4] hover:text-[#1E3A5F] transition">
                <MdAdd size={16} />Adicionar exercício
              </button>
            </div>
            {programExercises.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhum exercício vinculado ainda.</p>
            ) : (
              <div className="space-y-4">
                {programExercises.map(pe => (
                  <div key={pe.id} className="group">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 rounded-lg overflow-hidden">
                        <Avatar size={32} name={pe.exercise?.title ?? ''} variant="pixel" colors={AVATAR_COLORS} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{pe.exercise?.title}</p>
                        <p className="text-xs text-gray-400">{exerciseCategoryLabel[pe.exercise?.category ?? ''] ?? '—'}</p>
                      </div>
                      <button onClick={() => removeExercise(pe)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition">
                        <MdDeleteOutline size={18} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pl-11">
                      <span className="text-[10px] text-gray-400 w-14 shrink-0">Importância</span>
                      <input type="range" min={1} max={5} step={1}
                        value={exerciseWeights[pe.id] ?? 3}
                        onChange={e => {
                          weightsChanged.current = true
                          setExerciseWeights(prev => ({ ...prev, [pe.id]: Number(e.target.value) }))
                        }}
                        className="flex-1 accent-[#1E3A5F] h-1.5 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-[#1E3A5F] w-4 text-center shrink-0">
                        {exerciseWeights[pe.id] ?? 3}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Salvar pesos */}
          {(programPieces.length > 0 || programExercises.length > 0) && (
            <button onClick={saveWeights} disabled={savingWeights}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition disabled:opacity-50 mb-5">
              <MdSave size={17} />
              {savingWeights ? 'Salvando...' : 'Salvar pesos do objetivo'}
            </button>
          )}
        </>
      )}

      {programa.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-1">Observações</p>
          <p className="text-xs text-gray-600 leading-relaxed">{programa.notes}</p>
        </div>
      )}

      {/* Arquivar + Excluir na mesma linha */}
      <div className="flex gap-2 pb-2">
        {programa.status === 'active' && (
          <button onClick={archivePrograma}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition">
            <MdArchive size={17} />Arquivar
          </button>
        )}
        <button onClick={deletePrograma}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-100 text-sm text-red-400 hover:border-red-300 hover:text-red-600 transition">
          <MdDeleteOutline size={17} />Excluir
        </button>
      </div>
    </StudentLayout>
  )
}
