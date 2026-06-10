import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdNotes, MdMusicNote, MdSchool, MdClose } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { autoGeneratePlan } from '@/lib/autoplan'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'
import type { ProgramaType } from '@/types/programs'
import { PROGRAM_TYPES } from '@/lib/programTypes'

const TYPES = Object.entries(PROGRAM_TYPES)
  .filter(([value]) => value !== 'regular')
  .map(([value, cfg]) => ({ value: value as ProgramaType, ...cfg }))

// Cor de destaque por tipo — usada no hover do card
const TYPE_COLORS: Record<string, string> = {
  regular:      'from-[#1E3A5F] to-[#2d5a8e]',
  recital:      'from-[#7c3aed] to-[#a855f7]',
  concerto:     'from-[#0369a1] to-[#0ea5e9]',
  show:         'from-[#b45309] to-[#f59e0b]',
  gravacao:     'from-[#be123c] to-[#f43f5e]',
  exame:        'from-[#065f46] to-[#10b981]',
  participacao: 'from-[#1d4ed8] to-[#60a5fa]',
  outro:        'from-[#374151] to-[#6b7280]',
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  regular:      'Repertório do dia a dia',
  recital:      'Apresentação formal ao público',
  concerto:     'Performance orquestral',
  show:         'Palco ao vivo',
  gravacao:     'Estúdio ou gravação',
  exame:        'Banca ou prova técnica',
  participacao: 'Participação especial',
  outro:        'Outro objetivo',
}

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

  // Modal state
  const [selectedType, setSelectedType] = useState<ProgramaType | null>(null)

  // Form state (dentro do modal)
  const [title, setTitle]     = useState('')
  const [autoTitle, setAutoTitle] = useState(true)
  const [deadline, setDeadline] = useState('')
  const [venue, setVenue]     = useState('')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const [pieces, setPieces]       = useState<PieceItem[]>([])
  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [selectedPieceIds, setSelectedPieceIds]       = useState<Set<string>>(new Set())
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!profile) return
    supabase.from('students').select('id, teacher_id').eq('profile_id', profile.id).single()
      .then(({ data, error: err }) => {
        if (!data) { if (err) setError('Não foi possível carregar seu perfil.'); return }
        setStudentId(data.id)
        setTeacherId(data.teacher_id ?? profile.teacherId ?? null)
        Promise.all([
          supabase.from('pieces').select('id, title, composer').eq('student_id', data.id).order('title'),
          supabase.from('exercises').select('id, title, category').eq('student_id', data.id).order('title'),
        ]).then(([pr, er]) => { setPieces(pr.data ?? []); setExercises(er.data ?? []) })
      })
  }, [profile])

  function openModal(type: ProgramaType) {
    setSelectedType(type)
    setError('')
    const cfg = PROGRAM_TYPES[type]
    setTitle(autoTitle || title === '' ? (type === 'outro' ? '' : cfg.label) : title)
    setAutoTitle(true)
    setDeadline('')
    setVenue('')
    setNotes('')
    setSelectedPieceIds(new Set())
    setSelectedExerciseIds(new Set())
  }

  function closeModal() { setSelectedType(null); setError('') }

  function handleTitleChange(val: string) { setTitle(val); setAutoTitle(false) }

  function togglePiece(id: string, checked: boolean) {
    setSelectedPieceIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n })
  }
  function toggleExercise(id: string, checked: boolean) {
    setSelectedExerciseIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId || !selectedType) return
    setError('')
    const cfg = PROGRAM_TYPES[selectedType]
    if (cfg.needsDeadline && !deadline) { setError('Informe a data do evento.'); return }
    const finalTitle = title.trim() || (selectedType !== 'outro' ? cfg.label : '')
    if (!finalTitle) { setError('Informe o nome do programa.'); return }

    setSaving(true)
    try {
      const { data, error: err } = await supabase.from('programas').insert({
        student_id: studentId, teacher_id: teacherId,
        title: finalTitle, type: selectedType,
        deadline: deadline || null, venue: venue || null, notes: notes || null,
      }).select().single()
      if (err) throw err

      if (selectedType !== 'regular') {
        if (selectedPieceIds.size > 0)
          await supabase.from('program_pieces').insert([...selectedPieceIds].map(pieceId => ({ program_id: data.id, piece_id: pieceId })))
        if (selectedExerciseIds.size > 0)
          await supabase.from('program_exercises').insert([...selectedExerciseIds].map(exerciseId => ({ program_id: data.id, exercise_id: exerciseId })))
      }

      autoGeneratePlan(studentId!)
      toast.success('Programa criado!')
      navigate(`/aluno/repertorio/programas/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar programa.')
    } finally {
      setSaving(false)
    }
  }

  const cfg = selectedType ? PROGRAM_TYPES[selectedType] : null
  const SelectedIcon = cfg?.Icon ?? null
  const hasItems = pieces.length > 0 || exercises.length > 0

  return (
    <StudentLayout>
      {/* Back + separator-title */}
      <div className="flex items-center gap-3 mb-5">
        <Link to="/aluno/repertorio?tab=programs" className="text-gray-400 hover:text-gray-600 transition shrink-0">
          <MdArrowBack size={20} />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Novo programa</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      </div>

      {/* Cards grid — 4 colunas desktop, 2 colunas mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TYPES.map(t => {
          const gradient = TYPE_COLORS[t.value]
          const Icon = t.Icon
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => openModal(t.value)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className={`
                group relative flex flex-col items-center justify-center gap-2
                rounded-2xl p-5 text-center
                bg-gradient-to-br ${gradient}
                opacity-40
                hover:opacity-100
                transition-all duration-300 ease-out
                hover:scale-105 hover:shadow-lg hover:shadow-black/20
                active:scale-95
                cursor-pointer select-none
                [transform-origin:center]
                hover:[animation:blop_0.35s_cubic-bezier(0.34,1.56,0.64,1)_forwards]
              `}
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-snug">{t.label}</p>
                <p className="text-[10px] text-white/70 mt-0.5 leading-snug">{TYPE_DESCRIPTIONS[t.value]}</p>
              </div>
              {t.needsDeadline && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white/60" title="Precisa de data" />
              )}
            </button>
          )
        })}
      </div>

      {/* Blop keyframe via style tag */}
      <style>{`
        @keyframes blop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.08); }
          70%  { transform: scale(0.97); }
          100% { transform: scale(1.05); }
        }
      `}</style>

      {/* Modal */}
      {selectedType && cfg && SelectedIcon && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className={`bg-gradient-to-br ${TYPE_COLORS[selectedType]} px-5 pt-5 pb-6 relative`}>
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition"
              >
                <MdClose size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <SelectedIcon size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-snug">{cfg.label}</p>
                  <p className="text-white/70 text-xs mt-0.5">{TYPE_DESCRIPTIONS[selectedType]}</p>
                </div>
              </div>
            </div>

            {/* Modal body — scrollable */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="px-5 py-5 space-y-4">

                {/* Nome */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Nome do programa</label>
                  <input
                    value={title}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder={selectedType === 'outro' ? 'Nome do programa' : cfg.label}
                    maxLength={200}
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
                  />
                </div>

                {/* Data (se necessário) */}
                {cfg.needsDeadline && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Data do evento <span className="text-red-400">*</span></label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition"
                    />
                  </div>
                )}

                {/* Local */}
                {selectedType !== 'regular' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Local / Venue (opcional)</label>
                    <input
                      value={venue}
                      onChange={e => setVenue(e.target.value)}
                      placeholder="Ex: Teatro Municipal, Sala de Recitais..."
                      maxLength={200}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition"
                    />
                  </div>
                )}

                {/* Peças e exercícios (não-regular) */}
                {selectedType !== 'regular' && (
                  <div className="space-y-4">
                    {pieces.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <MdMusicNote size={13} />Peças
                          </h3>
                          <div className="flex gap-3">
                            <button type="button" onClick={() => setSelectedPieceIds(new Set(pieces.map(p => p.id)))}
                              className="text-xs text-[#4A90C4] hover:underline">Todas</button>
                            <button type="button" onClick={() => setSelectedPieceIds(new Set())}
                              className="text-xs text-gray-400 hover:underline">Nenhuma</button>
                          </div>
                        </div>
                        <div className="space-y-1">
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
                          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <MdSchool size={13} />Exercícios
                          </h3>
                          <div className="flex gap-3">
                            <button type="button" onClick={() => setSelectedExerciseIds(new Set(exercises.map(ex => ex.id)))}
                              className="text-xs text-[#4A90C4] hover:underline">Todos</button>
                            <button type="button" onClick={() => setSelectedExerciseIds(new Set())}
                              className="text-xs text-gray-400 hover:underline">Nenhum</button>
                          </div>
                        </div>
                        <div className="space-y-1">
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

                {selectedType === 'regular' && (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 leading-relaxed">
                    Todo o repertório ativo entra automaticamente na geração do planejamento.
                  </p>
                )}

                {/* Observações */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <MdNotes size={13} />Observações (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Contexto, repertório previsto, objetivos..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none"
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>

              {/* Modal footer */}
              <div className="px-5 pb-8 pt-1">
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full h-11 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl"
                >
                  {saving ? 'Criando...' : 'Criar programa'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StudentLayout>
  )
}
