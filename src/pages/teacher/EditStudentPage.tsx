import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdPerson, MdMusicNote, MdAccessTime, MdNotes } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

const INSTRUMENTS = [
  'Violão', 'Guitarra', 'Baixo', 'Piano', 'Teclado',
  'Violino', 'Viola', 'Violoncelo', 'Flauta', 'Saxofone',
  'Trompete', 'Bateria', 'Percussão', 'Canto', 'Outro',
]

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const AVAIL_MIN = 5
const AVAIL_MAX = 720

function toSliderPos(minutes: number): number {
  return Math.round(Math.log(minutes / AVAIL_MIN) / Math.log(AVAIL_MAX / AVAIL_MIN) * 100)
}
function fromSliderPos(pos: number): number {
  const raw = AVAIL_MIN * Math.pow(AVAIL_MAX / AVAIL_MIN, pos / 100)
  return Math.max(AVAIL_MIN, Math.round(raw / 5) * 5)
}
function fmtMin(m: number): string {
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60), r = m % 60
  return r === 0 ? `${h}h` : `${h}h${r}min`
}

interface DayAvailability {
  day: number
  active: boolean
  minutes: number
}

export default function EditStudentPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [instrument, setInstrument] = useState('')
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [availability, setAvailability] = useState<DayAvailability[]>(
    DAYS.map((_, i) => ({ day: i, active: false, minutes: 15 }))
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (studentId) fetchStudent()
  }, [studentId])

  async function fetchStudent() {
    const [studentRes, availRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId!).single(),
      supabase.from('student_availability').select('*').eq('student_id', studentId!).order('day_of_week'),
    ])

    if (studentRes.data) {
      const s = studentRes.data
      setFirstName(s.first_name)
      setLastName(s.last_name)
      setInstrument(s.instrument)
      setLevel(s.level)
      setPhone(s.contact_phone ?? '')
      setNotes(s.notes ?? '')
    }

    if (availRes.data && availRes.data.length > 0) {
      setAvailability(
        DAYS.map((_, i) => {
          const found = availRes.data.find((d: { day_of_week: number }) => d.day_of_week === i)
          return {
            day: i,
            active: found?.is_active ?? false,
            minutes: found?.minutes_available ?? 15,
          }
        })
      )
    }

    setLoading(false)
  }

  function toggleDay(index: number) {
    setAvailability(prev =>
      prev.map(d => d.day === index ? { ...d, active: !d.active } : d)
    )
  }

  function setMinutes(index: number, minutes: number) {
    setAvailability(prev =>
      prev.map(d => d.day === index ? { ...d, minutes } : d)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      await supabase
        .from('students')
        .update({
          first_name: firstName,
          last_name: lastName,
          instrument,
          level,
          contact_phone: phone || null,
          notes: notes || null,
        })
        .eq('id', studentId!)

      // Atualiza disponibilidade — deleta e recria
      await supabase.from('student_availability').delete().eq('student_id', studentId!)
      await supabase.from('student_availability').insert(
        availability.map(d => ({
          student_id: studentId!,
          day_of_week: d.day,
          is_active: d.active,
          minutes_available: d.active ? d.minutes : null,
        }))
      )

      toast.success('Alterações salvas!')
      navigate(`/professor/alunos/${studentId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const levelOptions = [
    { value: 'beginner', label: 'Iniciante' },
    { value: 'intermediate', label: 'Intermediário' },
    { value: 'advanced', label: 'Avançado' },
  ]

  if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/professor/alunos/${studentId}`} className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Editar aluno</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdPerson size={15} />Dados pessoais</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Nome</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} required maxLength={100}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Sobrenome</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} required maxLength={100}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Telefone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" maxLength={20}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdMusicNote size={15} />Instrumento</h2>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Instrumento</label>
            <select value={instrument} onChange={e => setInstrument(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white">
              <option value="">Selecione...</option>
              {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Nível</label>
            <div className="flex gap-2">
              {levelOptions.map(opt => (
                <button key={opt.value} type="button" onClick={() => setLevel(opt.value as typeof level)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition ${
                    level === opt.value ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdAccessTime size={15} />Disponibilidade semanal</h2>
          <div className="space-y-2">
            {availability.map(day => (
              <div key={day.day} className="flex items-center gap-3">
                <button type="button" onClick={() => toggleDay(day.day)}
                  className={`w-12 text-xs font-semibold py-1.5 rounded-lg border transition ${
                    day.active ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-400 border-gray-200'
                  }`}>
                  {DAYS[day.day]}
                </button>
                {day.active && (
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={toSliderPos(day.minutes)}
                      onChange={e => setMinutes(day.day, fromSliderPos(Number(e.target.value)))}
                      className="flex-1 accent-[#1E3A5F]"
                    />
                    <span className="text-xs font-bold text-[#1E3A5F] w-14 text-right shrink-0">
                      {fmtMin(day.minutes)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdNotes size={15} />Observações</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000}
            placeholder="Anotações sobre o aluno..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-none" />
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