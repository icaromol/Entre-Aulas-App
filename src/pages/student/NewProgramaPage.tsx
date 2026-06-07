import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdLibraryMusic, MdNotes, MdMusicNote, MdSchool } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'
import type { ProgramaType } from '@/types/programs'

const TYPES: { value: ProgramaType; label: string; emoji: string; needsDeadline: boolean }[] = [
  { value: 'regular',      label: 'Aulas Regulares', emoji: '📚', needsDeadline: false },
  { value: 'recital',      label: 'Recital',          emoji: '🎭', needsDeadline: true  },
  { value: 'concerto',     label: 'Concerto',         emoji: '🎹', needsDeadline: true  },
  { value: 'show',         label: 'Show',             emoji: '🎤', needsDeadline: true  },
  { value: 'gravacao',     label: 'Gravação',         emoji: '🎙️', needsDeadline: true  },
  { value: 'exame',        label: 'Exame',            emoji: '📋', needsDeadline: true  },
  { value: 'participacao', label: 'Participação',     emoji: '🎵', needsDeadline: false },
  { value: 'outro',        label: 'Outro',            emoji: '📁', needsDeadline: false },
]

interface PieceItem { id: string; title: string; composer: string | null }
interface ExerciseItem { id: string; title: string; category: string }

const exerciseCategoryLabel: Record<string, string> = {
  technique: 'Técnica', ear_training: 'Percepção', harmony: 'Harmonia',
  history: 'História', improvisation: 'Improvisação', other: 'Outro',
}

export default function StudentNewProgramaPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState<string | null>(null)
  const [teacherId, setTeacherId] = useState<string | null>(null)

  const [type, setType] = useState<ProgramaType>('regular')
  const [title, setTitle] = useState(TYPES[0].label)
  const [autoTitle, setAutoTitle] = useState(true)
  const [deadline, setDeadline] = useState('')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [pieces, setPieces] = useState<PieceItem[]>([])
  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<string>>(new Set())
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!profile) return
    supabase.from('students').select('id, teacher_id').eq('profile_id', profile.id).single()
      .then(({ data }) => {
        if (!data) return
        setStudentId(data.id)
        setTeacherId(data.teacher_id)
        Promise.all([
          supabase.from('pieces').select('id, title, composer').eq('student_id', data.id).order('title'),
          supabase.from('exercises').select('id, title, category').eq('student_id', data.id).order('title'),
        ]).then(([pr, er]) => {
          setPieces(pr.data ?? [])
          setExercises(er.data ?? [])
        })
      })
  }, [profile])

  const selected = TYPES.find(t => t.value === type)!

  function handleTypeChange(newType: ProgramaType) {
    setType(newType)
    if (autoTitle) setTitle(newType === 'outro' ? '' : TYPES.find(t => t.value === newType)!.label)
  }

  function handleTitleChange(val: string) { setTitle(val); setAutoTitle(false) }

  function togglePiece(id: string, checked: boolean) {
    setSelectedPieceIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n })
  }

  function toggleExercise(id: string, checked: boolean) {
    setSelectedExerciseIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!studentId) return
    if (selected.needsDeadline && !deadline) {
      setError('Informe a data do evento para este tipo de programa.'); return
    }
    const finalTitle = title.trim() || (type !== 'outro' ? selected.label : '')
    if (!finalTitle) { setError('Informe o nome do programa.'); return }

    setSaving(true)
    try {
      const { data, error: err } = await supabase.from('programas').insert({
        student_id: studentId, teacher_id: teacherId,
        title: finalTitle, type,
        deadline: deadline || null, venue: venue || null, notes: notes || null,
      }).select().single()

      if (err) throw err

      if (type !== 'regular') {
        if (selectedPieceIds.size > 0) {
          await supabase.from('program_pieces').insert(
            [...selectedPieceIds].map(pieceId => ({ program_id: data.id, piece_id: pieceId }))
          )
        }
        if (selectedExerciseIds.size > 0) {
          await supabase.from('program_exercises').insert(
            [...selectedExerciseIds].map(exerciseId => ({ program_id: data.id, exercise_id: exerciseId }))
          )
        }
      }

      toast.success('Programa criado!')
      navigate(`/aluno/repertorio/programas/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar programa.')
    } finally {
      setSaving(false)
    }
  }

  const hasItems = pieces.length > 0 || exercises.length > 0

  return (
    <StudentLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/aluno/repertorio?tab=programs" className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Novo programa</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl mx-auto">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdLibraryMusic size={15} />Objetivo
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                className={`py-3 px-3 rounded-xl border text-sm font-medium transition flex items-center gap-2 ${
                  type === t.value
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                }`}>
                <span>{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>
          {type === 'regular' && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 leading-relaxed">
              Todo o repertório ativo entra automaticamente na geração do planejamento.
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Nome do programa</label>
            <input value={title} onChange={e => handleTitleChange(e.target.value)}
              placeholder={type === 'outro' ? 'Nome do programa' : selected.label}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
          </div>

          {selected.needsDeadline && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Data do evento <span className="text-red-400">*</span></label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition" />
            </div>
          )}

          {type !== 'regular' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Local / Venue (opcional)</label>
              <input value={venue} onChange={e => setVenue(e.target.value)}
                placeholder="Ex: Teatro Municipal, Sala de Recitais..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition" />
            </div>
          )}
        </div>

        {type !== 'regular' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
            {pieces.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                    <MdMusicNote size={15} />Peças
                  </h2>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setSelectedPieceIds(new Set(pieces.map(p => p.id)))}
                      className="text-xs text-[#4A90C4] hover:underline">Marcar todas</button>
                    <button type="button" onClick={() => setSelectedPieceIds(new Set())}
                      className="text-xs text-gray-400 hover:underline">Desmarcar</button>
                  </div>
                </div>
                <div className="space-y-1 mt-1">
                  {pieces.map(piece => (
                    <label key={piece.id} className="flex items-start gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition">
                      <input type="checkbox" checked={selectedPieceIds.has(piece.id)}
                        onChange={e => togglePiece(piece.id, e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#4A90C4] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{piece.title}</p>
                        {piece.composer && <p className="text-xs text-gray-400 truncate">{piece.composer}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {exercises.length > 0 && (
              <div className="space-y-2">
                {pieces.length > 0 && <div className="border-t border-gray-100" />}
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                    <MdSchool size={15} />Exercícios
                  </h2>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setSelectedExerciseIds(new Set(exercises.map(ex => ex.id)))}
                      className="text-xs text-[#4A90C4] hover:underline">Marcar todos</button>
                    <button type="button" onClick={() => setSelectedExerciseIds(new Set())}
                      className="text-xs text-gray-400 hover:underline">Desmarcar</button>
                  </div>
                </div>
                <div className="space-y-1 mt-1">
                  {exercises.map(ex => (
                    <label key={ex.id} className="flex items-start gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition">
                      <input type="checkbox" checked={selectedExerciseIds.has(ex.id)}
                        onChange={e => toggleExercise(ex.id, e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#4A90C4] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{ex.title}</p>
                        <p className="text-xs text-gray-400">{exerciseCategoryLabel[ex.category] ?? ex.category}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!hasItems && (
              <p className="text-xs text-gray-400 text-center py-2">Nenhuma peça ou exercício cadastrado ainda.</p>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdNotes size={15} />Observações (opcional)
          </h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Contexto, repertório previsto, objetivos..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" disabled={saving || !studentId}
          className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10">
          {saving ? 'Salvando...' : 'Criar programa'}
        </Button>

      </form>
    </StudentLayout>
  )
}
