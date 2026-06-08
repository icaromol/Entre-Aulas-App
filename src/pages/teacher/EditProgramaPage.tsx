import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdLibraryMusic, MdNotes } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
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

export default function EditProgramaPage() {
  const { studentId, programId } = useParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [type, setType] = useState<ProgramaType>('regular')
  const [deadline, setDeadline] = useState('')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (programId) fetchPrograma()
  }, [programId])

  async function fetchPrograma() {
    const { data } = await supabase.from('programas').select('*').eq('id', programId!).single()
    if (data) {
      setTitle(data.title)
      setType(data.type)
      setDeadline(data.deadline ?? '')
      setVenue(data.venue ?? '')
      setNotes(data.notes ?? '')
    }
    setLoading(false)
  }

  const selected = TYPES.find(t => t.value === type)!

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (selected.needsDeadline && !deadline) {
      setError('Informe a data do evento para este tipo de programa.')
      return
    }

    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('programas')
        .update({
          title,
          type,
          deadline: deadline || null,
          venue: venue || null,
          notes: notes || null,
        })
        .eq('id', programId!)

      if (err) throw err
      toast.success('Programa atualizado!')
      navigate(`/professor/alunos/${studentId}/programas/${programId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (!isValidUUID(studentId) || !isValidUUID(programId)) return <Navigate to="/" replace />
  if (loading) return <TeacherLayout><div className="flex justify-center py-12"><Spinner /></div></TeacherLayout>

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}/programas/${programId}`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Editar programa</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Tipo */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdLibraryMusic size={15} />Objetivo
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`py-3 px-3 rounded-xl border text-sm font-medium transition flex items-center gap-2 ${
                  type === t.value
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                }`}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
          {type === 'regular' && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 leading-relaxed">
              Todo o repertório ativo do aluno entra automaticamente na geração do planejamento.
            </p>
          )}
        </div>

        {/* Título e detalhes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Nome do programa</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
            />
          </div>

          {selected.needsDeadline && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Data do evento <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition"
              />
            </div>
          )}

          {type !== 'regular' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Local / Venue (opcional)</label>
              <input
                value={venue}
                onChange={e => setVenue(e.target.value)}
                placeholder="Ex: Teatro Municipal, Sala de Recitais..."
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition"
              />
            </div>
          )}
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
            <MdNotes size={15} />Observações (opcional)
          </h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" disabled={saving}
          className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10">
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>

      </form>
    </TeacherLayout>
  )
}
