import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MdClose, MdFlag, MdMusicNote, MdNotes, MdSchool } from 'react-icons/md'
import { PillSlider } from '@/components/ui/PillSlider'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { autoGeneratePlan } from '@/lib/autoplan'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'
import { PROGRAM_TYPES } from '@/lib/programTypes'
import type { ProgramaType } from '@/types/programs'

const OBJETIVO_CARDS: {
  value: ProgramaType
  label: string
  description: string
}[] = [
  { value: 'recital',  label: 'Apresentação', description: 'Recital, concerto, show ou performance' },
  { value: 'gravacao', label: 'Gravação',      description: 'Estúdio ou gravação'                   },
  { value: 'exame',    label: 'Exame',         description: 'Banca, prova ou avaliação técnica'     },
  { value: 'outro',    label: 'Outro',         description: 'Objetivo personalizado'                },
]

const exerciseCategoryLabel: Record<string, string> = {
  technique: 'Técnica', ear_training: 'Percepção', harmony: 'Harmonia',
  history: 'História', improvisation: 'Improvisação', other: 'Outro',
}


function daysUntil(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(date + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

interface Objetivo {
  id: string; title: string; type: string; status: string; deadline: string | null; priority: number | null
}

export default function ObjetivosPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const modalOpenedRef = useRef(false)

  const [objetivos, setObjetivos] = useState<Objetivo[]>([])
  const [studentId, setStudentId]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [priorities, setPriorities] = useState<Record<string, number>>({})
  const [savingPriorities, setSavingPriorities] = useState(false)

  // Modal de novo objetivo
  const [newType, setNewType]             = useState<ProgramaType | null>(null)
  const [newTitle, setNewTitle]           = useState('')
  const [newDeadline, setNewDeadline]     = useState('')
  const [newVenue, setNewVenue]           = useState('')
  const [newNotes, setNewNotes]           = useState('')
  const [newSaving, setNewSaving]         = useState(false)
  const [newError, setNewError]           = useState('')
  const [newPieceIds, setNewPieceIds]     = useState<Set<string>>(new Set())
  const [newExIds, setNewExIds]           = useState<Set<string>>(new Set())
  const [modalPieces, setModalPieces]     = useState<{ id: string; title: string; composer: string | null }[]>([])
  const [modalExercises, setModalExercises] = useState<{ id: string; title: string; category: string }[]>([])

  useEffect(() => {
    if (profile) fetchAll()
  }, [profile])

  // Abre modal automaticamente se ?new=TYPE na URL (deep link do planejamento)
  useEffect(() => {
    if (studentId && !modalOpenedRef.current) {
      const newParam = searchParams.get('new') as ProgramaType | null
      if (newParam && OBJETIVO_CARDS.some(c => c.value === newParam)) {
        modalOpenedRef.current = true
        openModal(newParam)
      }
    }
  }, [studentId, searchParams])

  async function fetchAll() {
    const { data: student } = await supabase
      .from('students').select('id').eq('profile_id', profile!.id).single()
    if (!student) { setLoading(false); return }
    setStudentId(student.id)

    const { data } = await supabase
      .from('programas')
      .select('id, title, type, status, deadline, priority')
      .eq('student_id', student.id)
      .neq('type', 'regular')
      .neq('status', 'archived')
      .order('title')
    const list = data ?? []
    setObjetivos(list)
    setPriorities(Object.fromEntries(list.map(o => [o.id, o.priority ?? 3])))
    setLoading(false)
  }

  async function savePriorities() {
    setSavingPriorities(true)
    try {
      const results = await Promise.all(
        objetivos.map(o =>
          supabase.from('programas').update({ priority: priorities[o.id] ?? 3 }).eq('id', o.id)
        )
      )
      const failed = results.find(r => r.error)
      if (failed?.error) throw failed.error
      toast.success('Prioridades salvas!')
      if (studentId) autoGeneratePlan(studentId)
    } catch {
      toast.error('Erro ao salvar prioridades.')
    } finally {
      setSavingPriorities(false)
    }
  }

  function openModal(type: ProgramaType) {
    const cfg = PROGRAM_TYPES[type]
    setNewType(type)
    setNewTitle(type === 'outro' ? '' : cfg.label)
    setNewDeadline(''); setNewVenue(''); setNewNotes('')
    setNewError(''); setNewPieceIds(new Set()); setNewExIds(new Set())
    if (studentId) {
      Promise.all([
        supabase.from('pieces').select('id, title, composer').eq('student_id', studentId).order('title'),
        supabase.from('exercises').select('id, title, category').eq('student_id', studentId).order('title'),
      ]).then(([pr, er]) => { setModalPieces(pr.data ?? []); setModalExercises(er.data ?? []) })
    }
  }

  function closeModal() { setNewType(null); setNewError('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId || !newType) return
    setNewError('')
    const cfg = PROGRAM_TYPES[newType]
    if (cfg.needsDeadline && !newDeadline) { setNewError('Informe a data do evento.'); return }
    const finalTitle = newTitle.trim() || (newType !== 'outro' ? cfg.label : '')
    if (!finalTitle) { setNewError('Informe o nome do objetivo.'); return }

    setNewSaving(true)
    try {
      const { data: studentRow } = await supabase.from('students').select('teacher_id').eq('id', studentId).single()
      const teacherId = studentRow?.teacher_id ?? null

      const { data, error: err } = await supabase.from('programas').insert({
        student_id: studentId, teacher_id: teacherId,
        title: finalTitle, type: newType,
        deadline: newDeadline || null, venue: newVenue || null, notes: newNotes || null,
      }).select().single()
      if (err) throw err

      if (newPieceIds.size > 0)
        await supabase.from('program_pieces').insert([...newPieceIds].map(pieceId => ({ program_id: data.id, piece_id: pieceId })))
      if (newExIds.size > 0)
        await supabase.from('program_exercises').insert([...newExIds].map(exerciseId => ({ program_id: data.id, exercise_id: exerciseId })))

      toast.success('Objetivo criado!')
      navigate(`/aluno/repertorio/programas/${data.id}`)
    } catch (err: unknown) {
      setNewError(err instanceof Error ? err.message : 'Erro ao criar objetivo.')
    } finally {
      setNewSaving(false)
    }
  }

  if (loading) return <StudentLayout><div className="flex justify-center py-12"><Spinner /></div></StudentLayout>

  return (
    <StudentLayout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#153b50]">Objetivos</h1>
        <p className="text-sm text-gray-400 mt-0.5">Suas metas e eventos musicais</p>
      </div>

      <div className="space-y-3">

        {/* Empty state */}
        {objetivos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#153b50] flex items-center justify-center mx-auto mb-3">
              <MdFlag size={22} className="text-white" />
            </div>
            <p className="text-base font-bold text-[#153b50]">Onde você quer chegar?</p>
            <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">Defina um objetivo e o seu plano se adapta a você.</p>
          </div>
        )}

        {/* Lista de objetivos */}
        {objetivos.map(obj => {
          const days = obj.deadline ? daysUntil(obj.deadline) : null
          const ObjIcon = (PROGRAM_TYPES[obj.type] ?? PROGRAM_TYPES.outro).Icon
          return (
            <div key={obj.id}
              className="w-full bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-[#b2f0fb]/40 transition">

              {/* Título — visível apenas em telas pequenas, acima do conteúdo */}
              <p
                className="sm:hidden text-xs font-semibold text-gray-700 text-center mb-2 truncate cursor-pointer"
                onClick={() => navigate(`/aluno/repertorio/programas/${obj.id}`)}>
                {obj.title}
              </p>

              {/* Linha principal: ícone + título (sm+) + badge + slider */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full bg-[#153b50] flex items-center justify-center shrink-0 cursor-pointer"
                  onClick={() => navigate(`/aluno/repertorio/programas/${obj.id}`)}>
                  <ObjIcon size={18} color="white" />
                </div>

                {/* Título — visível a partir de sm */}
                <div className="hidden sm:flex flex-col min-w-0 cursor-pointer" onClick={() => navigate(`/aluno/repertorio/programas/${obj.id}`)}>
                  <p className="text-sm font-semibold text-gray-800 truncate">{obj.title}</p>
                </div>

                {days !== null && (
                  <span className={`hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                    days < 0  ? 'bg-gray-100 text-gray-400' :
                    days < 14 ? 'bg-[#ffeceb] text-[#ff4c3e]' :
                    days < 30 ? 'bg-[#eff7fb] text-[#153b50]' :
                                'bg-[#eff7fb] text-[#153b50]'
                  }`}>
                    {days < 0 ? 'passou' : days === 0 ? 'hoje' : `${days}d`}
                  </span>
                )}

                <div className="flex-1" onClick={e => e.stopPropagation()}>
                  <PillSlider
                    value={priorities[obj.id] ?? 3}
                    min={1}
                    max={5}
                    onChange={v => setPriorities(prev => ({ ...prev, [obj.id]: v }))}
                  />
                </div>
              </div>
            </div>
          )
        })}

        {/* Botão salvar prioridades */}
        {objetivos.length > 0 && (
          <button
            onClick={savePriorities}
            disabled={savingPriorities}
            className="w-full flex items-center justify-center gap-2 bg-[#153b50] hover:bg-[#153b50]/90 text-white text-sm font-semibold py-3 rounded-xl transition disabled:opacity-60">
            {savingPriorities ? 'Salvando…' : 'Salvar objetivos'}
          </button>
        )}

        {/* Separador */}
        <div className="flex items-center gap-3 pt-10 pb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
            {objetivos.length === 0 ? 'Crie seu primeiro objetivo' : 'Novo objetivo'}
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Cards modernos com dots */}
        <div className="grid grid-cols-2 gap-4 pt-2 pb-6">
          {OBJETIVO_CARDS.map((card) => {
            const Icon = PROGRAM_TYPES[card.value].Icon
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => openModal(card.value)}
                className="group flex flex-col items-center gap-2.5 rounded-2xl p-5 bg-white border border-gray-100
                  opacity-40 hover:opacity-100 hover:shadow-md hover:scale-[1.02] hover:border-[#b2f0fb]/30
                  transition-all duration-300 active:scale-[0.98] text-center
                  cursor-pointer select-none"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Ícone */}
                <div className="w-10 h-10 rounded-xl bg-gray-200 group-hover:bg-[#153b50] flex items-center justify-center transition-colors duration-300">
                  <Icon size={18} className="text-gray-500 group-hover:text-white transition-colors duration-300" />
                </div>

                {/* Label e descrição */}
                <div>
                  <p className="text-sm font-bold text-gray-600 group-hover:text-[#153b50] leading-snug transition-colors duration-300">{card.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{card.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal de novo objetivo */}
      {newType && (() => {
        const cfg = PROGRAM_TYPES[newType]
        const SelIcon = cfg.Icon
        const cardDesc = OBJETIVO_CARDS.find(c => c.value === newType)?.description ?? ''
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
            onClick={closeModal}
          >
            <div
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[#153b50] px-5 pt-5 pb-6 relative flex items-center gap-3">
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition"
                >
                  <MdClose size={18} />
                </button>
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <SelIcon size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-snug">{cfg.label}</p>
                  <p className="text-white/60 text-xs mt-0.5">{cardDesc}</p>
                </div>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
                <div className="px-5 py-5 space-y-4">

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Nome do objetivo</label>
                    <input
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder={newType === 'outro' ? 'Nome do objetivo' : cfg.label}
                      maxLength={200}
                      autoFocus
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition"
                    />
                  </div>

                  {cfg.needsDeadline && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Data do evento <span className="text-red-400">*</span></label>
                      <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] transition" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Local / Venue (opcional)</label>
                    <input value={newVenue} onChange={e => setNewVenue(e.target.value)}
                      placeholder="Ex: Teatro Municipal..."
                      maxLength={200}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] transition" />
                  </div>

                  {(modalPieces.length > 0 || modalExercises.length > 0) && (
                    <div className="space-y-4">
                      {modalPieces.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              <MdMusicNote size={13} />Peças
                            </h3>
                            <div className="flex gap-3">
                              <button type="button" onClick={() => setNewPieceIds(new Set(modalPieces.map(p => p.id)))} className="text-xs text-[#b2f0fb] hover:underline">Todas</button>
                              <button type="button" onClick={() => setNewPieceIds(new Set())} className="text-xs text-gray-400 hover:underline">Nenhuma</button>
                            </div>
                          </div>
                          {modalPieces.map(p => (
                            <label key={p.id} className="flex items-start gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition">
                              <input type="checkbox" checked={newPieceIds.has(p.id)}
                                onChange={e => setNewPieceIds(prev => { const n = new Set(prev); e.target.checked ? n.add(p.id) : n.delete(p.id); return n })}
                                className="mt-0.5 w-4 h-4 accent-[#b2f0fb] shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 truncate">{p.title}</p>
                                {p.composer && <p className="text-xs text-gray-400 truncate">{p.composer}</p>}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      {modalExercises.length > 0 && (
                        <div className="space-y-2">
                          {modalPieces.length > 0 && <div className="border-t border-gray-100" />}
                          <div className="flex items-center justify-between">
                            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              <MdSchool size={13} />Exercícios
                            </h3>
                            <div className="flex gap-3">
                              <button type="button" onClick={() => setNewExIds(new Set(modalExercises.map(e => e.id)))} className="text-xs text-[#b2f0fb] hover:underline">Todos</button>
                              <button type="button" onClick={() => setNewExIds(new Set())} className="text-xs text-gray-400 hover:underline">Nenhum</button>
                            </div>
                          </div>
                          {modalExercises.map(ex => (
                            <label key={ex.id} className="flex items-start gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition">
                              <input type="checkbox" checked={newExIds.has(ex.id)}
                                onChange={e => setNewExIds(prev => { const n = new Set(prev); e.target.checked ? n.add(ex.id) : n.delete(ex.id); return n })}
                                className="mt-0.5 w-4 h-4 accent-[#b2f0fb] shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 truncate">{ex.title}</p>
                                <p className="text-xs text-gray-400">{exerciseCategoryLabel[ex.category] ?? ex.category}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <MdNotes size={13} />Observações (opcional)
                    </label>
                    <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)}
                      rows={3} maxLength={2000}
                      placeholder="Contexto, repertório previsto, objetivos..."
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] transition resize-none" />
                  </div>

                  {newError && <p className="text-sm text-red-500">{newError}</p>}
                </div>

                <div className="px-5 pb-8 pt-1">
                  <Button type="submit" disabled={newSaving}
                    className="w-full h-11 bg-[#153b50] hover:bg-[#153b50]/90 text-white rounded-xl">
                    {newSaving ? 'Criando...' : 'Criar objetivo'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

    </StudentLayout>
  )
}
