import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdAdd, MdDeleteOutline, MdEdit, MdMusicNote, MdSchool, MdCalendarMonth, MdLocationOn } from 'react-icons/md'
import Avatar from 'boring-avatars'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/utils'
import { autoGeneratePlan } from '@/lib/autoplan'
import { Spinner } from '@/components/ui/Spinner'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import type { Programa, ProgramPiece, ProgramExercise } from '@/types/programs'

const AVATAR_COLORS = ['#1E3A5F', '#4A90C4', '#D6E4F0', '#F5F7FA', '#FFFFFF']

const typeLabel: Record<string, string> = {
  regular: 'Aulas Regulares', recital: 'Recital', concerto: 'Concerto',
  show: 'Show', gravacao: 'Gravação', exame: 'Exame',
  participacao: 'Participação', outro: 'Outro',
}

const typeBadgeColor: Record<string, string> = {
  regular: 'bg-blue-50 text-blue-600',
  recital: 'bg-purple-50 text-purple-600',
  concerto: 'bg-indigo-50 text-indigo-600',
  show: 'bg-pink-50 text-pink-600',
  gravacao: 'bg-red-50 text-red-600',
  exame: 'bg-amber-50 text-amber-700',
  participacao: 'bg-green-50 text-green-700',
  outro: 'bg-gray-100 text-gray-600',
}

const categoryLabel: Record<string, string> = {
  technique: 'Técnica', other: 'Outro',
}

interface AvailablePiece {
  id: string; title: string; composer: string | null
  completion_pct: number; difficulty: number | null
}
interface AvailableExercise {
  id: string; title: string; category: string; difficulty: number | null
}

function formatDeadline(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function daysUntil(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(date + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ProgramaDetailPage() {
  const { studentId, programId } = useParams()
  const navigate = useNavigate()

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
    setProgramPieces((piecesRes.data ?? []) as unknown as ProgramPiece[])
    setProgramExercises((exercisesRes.data ?? []) as unknown as ProgramExercise[])
    setLoading(false)
  }

  async function openPiecePicker() {
    const linkedIds = programPieces.map(pp => pp.piece_id)
    const { data } = await supabase
      .from('pieces').select('id, title, composer, completion_pct, difficulty')
      .eq('student_id', studentId!).order('title')
    setAvailablePieces((data ?? []).filter(p => !linkedIds.includes(p.id)))
    setShowPiecePicker(true)
  }

  async function addPiece(pieceId: string) {
    setAddingPieceId(pieceId)
    const { data } = await supabase.from('program_pieces')
      .insert({ program_id: programId!, piece_id: pieceId })
      .select('id, program_id, piece_id, priority_override, piece:pieces(id, title, composer, completion_pct, difficulty)')
      .single()
    if (data) {
      setProgramPieces(prev => [...prev, data as unknown as ProgramPiece])
      setAvailablePieces(prev => prev.filter(p => p.id !== pieceId))
      toast.success('Peça adicionada ao programa')
      autoGeneratePlan(studentId!)
    }
    setAddingPieceId(null)
  }

  async function removePiece(pp: ProgramPiece) {
    await supabase.from('program_pieces').delete().eq('id', pp.id)
    setProgramPieces(prev => prev.filter(p => p.id !== pp.id))
    if (pp.piece) setAvailablePieces(prev => [...prev, pp.piece as AvailablePiece])
    autoGeneratePlan(studentId!)
  }

  async function openExercisePicker() {
    const linkedIds = programExercises.map(pe => pe.exercise_id)
    const { data } = await supabase
      .from('exercises').select('id, title, category, difficulty')
      .eq('student_id', studentId!).order('title')
    setAvailableExercises((data ?? []).filter(e => !linkedIds.includes(e.id)))
    setShowExercisePicker(true)
  }

  async function addExercise(exerciseId: string) {
    setAddingExerciseId(exerciseId)
    const { data } = await supabase.from('program_exercises')
      .insert({ program_id: programId!, exercise_id: exerciseId })
      .select('id, program_id, exercise_id, priority_override, exercise:exercises(id, title, category, difficulty)')
      .single()
    if (data) {
      setProgramExercises(prev => [...prev, data as unknown as ProgramExercise])
      setAvailableExercises(prev => prev.filter(e => e.id !== exerciseId))
      toast.success('Exercício adicionado ao programa')
      autoGeneratePlan(studentId!)
    }
    setAddingExerciseId(null)
  }

  async function removeExercise(pe: ProgramExercise) {
    await supabase.from('program_exercises').delete().eq('id', pe.id)
    setProgramExercises(prev => prev.filter(p => p.id !== pe.id))
    if (pe.exercise) setAvailableExercises(prev => [...prev, pe.exercise as AvailableExercise])
    autoGeneratePlan(studentId!)
  }

  async function archivePrograma() {
    const isEvent = programa?.type !== 'regular'
    const newStatus = isEvent ? 'completed' : 'archived'
    const msg = isEvent
      ? 'Marcar este programa como concluído? Ele sairá da lista ativa.'
      : 'Arquivar este programa? Ele deixará de aparecer na lista ativa.'
    if (!confirm(msg)) return
    await supabase.from('programas').update({ status: newStatus }).eq('id', programId!)
    setPrograma(prev => prev ? { ...prev, status: newStatus as 'completed' | 'archived' } : prev)
    toast.success(isEvent ? 'Programa concluído!' : 'Programa arquivado')
    autoGeneratePlan(studentId!)
  }

  async function deletePrograma() {
    if (!confirm('Excluir permanentemente este programa? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from('programas').delete().eq('id', programId!)
    if (error) { toast.error('Erro ao excluir programa.'); return }
    autoGeneratePlan(studentId!)
    toast.success('Programa excluído')
    navigate(`/professor/alunos/${studentId}?tab=programs`)
  }

  if (!isValidUUID(studentId) || !isValidUUID(programId)) return <Navigate to="/" replace />
  if (loading) return <TeacherLayout><div className="flex justify-center py-12"><Spinner /></div></TeacherLayout>
  if (!programa) return <TeacherLayout><p className="text-sm text-red-400">Programa não encontrado.</p></TeacherLayout>

  const days = programa.deadline ? daysUntil(programa.deadline) : null

  const Picker = ({ show, title: pickerTitle, items, addingId, onAdd, onClose, renderItem }: {
    show: boolean
    title: string
    items: { id: string; title: string }[]
    addingId: string | null
    onAdd: (id: string) => void
    onClose: () => void
    renderItem: (item: { id: string; title: string }) => React.ReactNode
  }) => show ? (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={onClose}>
      <div className="bg-white rounded-t-2xl p-5 w-full max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#1E3A5F]">{pickerTitle}</h2>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">✕</button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Tudo já está no programa.</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => onAdd(item.id)}
                disabled={addingId === item.id}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#4A90C4] transition text-left disabled:opacity-50"
              >
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
    <TeacherLayout>
      {/* Piece Picker */}
      <Picker
        show={showPiecePicker}
        title="Adicionar peça"
        items={availablePieces}
        addingId={addingPieceId}
        onAdd={addPiece}
        onClose={() => setShowPiecePicker(false)}
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

      {/* Exercise Picker */}
      <Picker
        show={showExercisePicker}
        title="Adicionar exercício"
        items={availableExercises}
        addingId={addingExerciseId}
        onAdd={addExercise}
        onClose={() => setShowExercisePicker(false)}
        renderItem={item => {
          const ex = item as AvailableExercise
          return (
            <>
              <div className="shrink-0 rounded-lg overflow-hidden">
                <Avatar size={32} name={ex.title} variant="pixel" colors={AVATAR_COLORS} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{ex.title}</p>
                <p className="text-xs text-gray-400">{categoryLabel[ex.category] ?? ex.category}</p>
              </div>
            </>
          )
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}?tab=programs`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E3A5F]">{programa.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeBadgeColor[programa.type] ?? 'bg-gray-100 text-gray-600'}`}>
              {typeLabel[programa.type] ?? programa.type}
            </span>
            {programa.status === 'archived' && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                Arquivado
              </span>
            )}
          </div>
        </div>
        <Link to={`/professor/alunos/${studentId}/programas/${programId}/editar`} className="text-gray-400 hover:text-[#4A90C4] transition">
          <MdEdit size={20} />
        </Link>
      </div>

      {/* Deadline + Venue */}
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
              <MdLocationOn size={16} className="text-gray-400 shrink-0" />
              {programa.venue}
            </div>
          )}
        </div>
      )}

      {/* Repertório */}
      {programa.type === 'regular' ? (
        <div className="bg-[#D6E4F0]/40 rounded-2xl border border-[#D6E4F0] p-5 mb-5 text-center">
          <MdMusicNote size={24} className="mx-auto text-[#4A90C4] mb-2" />
          <p className="text-sm font-semibold text-[#1E3A5F]">Repertório completo</p>
          <p className="text-xs text-gray-500 mt-1">
            Todo o repertório ativo do aluno entra automaticamente no planejamento.
          </p>
        </div>
      ) : (
        <>
          {/* Peças */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                <MdMusicNote size={15} />Peças ({programPieces.length})
              </h2>
              <button onClick={openPiecePicker}
                className="flex items-center gap-1 text-xs font-medium text-[#4A90C4] hover:text-[#1E3A5F] transition">
                <MdAdd size={16} />Adicionar
              </button>
            </div>
            {programPieces.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhuma peça vinculada ainda.</p>
            ) : (
              <div className="space-y-3">
                {programPieces.map(pp => (
                  <div key={pp.id} className="flex items-center gap-3 group">
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
                ))}
              </div>
            )}
          </div>

          {/* Exercícios */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                <MdSchool size={15} />Exercícios ({programExercises.length})
              </h2>
              <button onClick={openExercisePicker}
                className="flex items-center gap-1 text-xs font-medium text-[#4A90C4] hover:text-[#1E3A5F] transition">
                <MdAdd size={16} />Adicionar
              </button>
            </div>
            {programExercises.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhum exercício vinculado ainda.</p>
            ) : (
              <div className="space-y-3">
                {programExercises.map(pe => (
                  <div key={pe.id} className="flex items-center gap-3 group">
                    <div className="shrink-0 rounded-lg overflow-hidden">
                      <Avatar size={32} name={pe.exercise?.title ?? ''} variant="pixel" colors={AVATAR_COLORS} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{pe.exercise?.title}</p>
                      <p className="text-xs text-gray-400">{categoryLabel[pe.exercise?.category ?? ''] ?? '—'}</p>
                    </div>
                    <button onClick={() => removeExercise(pe)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition">
                      <MdDeleteOutline size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Observações */}
      {programa.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-1">Observações</p>
          <p className="text-xs text-gray-600 leading-relaxed">{programa.notes}</p>
        </div>
      )}

      {programa.status === 'active' && (
        <button
          onClick={archivePrograma}
          className="w-full py-3 rounded-2xl border border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition mb-2"
        >
          {programa.type !== 'regular' ? 'Concluir programa' : 'Arquivar programa'}
        </button>
      )}
      <button
        onClick={deletePrograma}
        className="w-full py-3 rounded-2xl border border-red-100 text-sm text-red-400 hover:border-red-300 hover:text-red-600 transition"
      >
        Excluir programa
      </button>
    </TeacherLayout>
  )
}
