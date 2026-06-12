import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdArrowBack, MdPerson, MdMusicNote, MdAccessTime, MdNotes, MdAdd,
  MdPiano, MdMic, MdGraphicEq, MdSchool, MdTrendingUp, MdEmojiEvents,
} from 'react-icons/md'
import type { IconType } from 'react-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { grantTeacherXp } from '@/lib/teacherXpHelpers'
import { fireBasic, fireStars } from '@/lib/confettiEffects'
import { sound } from '@/lib/soundEffects'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

const INSTRUMENTS: { value: string; Icon: IconType }[] = [
  { value: 'Violão',   Icon: MdMusicNote },
  { value: 'Piano',    Icon: MdPiano     },
  { value: 'Guitarra', Icon: MdMusicNote },
  { value: 'Baixo',    Icon: MdGraphicEq },
  { value: 'Bateria',  Icon: MdGraphicEq },
  { value: 'Canto',    Icon: MdMic       },
  { value: 'Violino',  Icon: MdMusicNote },
  { value: 'Saxofone', Icon: MdMusicNote },
]

const LEVELS: { value: string; label: string; Icon: IconType; bars: number }[] = [
  { value: 'beginner',     label: 'Iniciante',     Icon: MdSchool,       bars: 1 },
  { value: 'intermediate', label: 'Intermediário', Icon: MdTrendingUp,   bars: 2 },
  { value: 'advanced',     label: 'Avançado',      Icon: MdEmojiEvents,  bars: 3 },
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

export default function NewStudentPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [instrument, setInstrument] = useState('')
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [availability, setAvailability] = useState<DayAvailability[]>(
    DAYS.map((_, i) => ({ day: i, active: false, minutes: 15 }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    setLoading(true)

    try {
      // 1. Busca o teacher_id
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', profile!.id)
        .single()

      if (!teacher) throw new Error('Professor não encontrado.')

      // 2. Cria o aluno
      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({
          teacher_id: teacher.id,
          first_name: firstName,
          last_name: lastName,
          instrument,
          level,
          contact_email: email,
          contact_phone: phone || null,
          notes: notes || null,
          status: 'active',
        })
        .select('id, invite_token')
        .single()

      if (studentError?.code === '23505') throw new Error('Este e-mail já está cadastrado para outro aluno.')
      if (studentError || !student) throw new Error('Erro ao criar aluno.')

      // 4. Salva disponibilidade
      const availabilityRows = availability.map(d => ({
        student_id: student.id,
        day_of_week: d.day,
        is_active: d.active,
        minutes_available: d.active ? d.minutes : null,
      }))

      await supabase.from('student_availability').insert(availabilityRows)

      // 5. XP do professor + confetti
      const { newAchievements } = await grantTeacherXp(teacher.id, 'new_student', student.id)
      sound.xpEarn()
      if (newAchievements.length > 0) fireStars()
      else fireBasic()

      // 6. Gera link de convite e redireciona
      const inviteLink = `${window.location.origin}/cadastro?invite=${student.id}&token=${(student as { id: string; invite_token: string }).invite_token}`
      toast.success('Aluno cadastrado com sucesso!')
      navigate('/professor/alunos', { state: { inviteLink, studentName: firstName, studentEmail: email } })

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/professor/alunos" className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#153b50]">Novo aluno</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdPerson size={15} />Dados pessoais</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Nome <span className="text-red-400">*</span></label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Ex: João"
                required
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition placeholder:text-gray-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Sobrenome <span className="text-red-400">*</span></label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Ex: Silva"
                required
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">E-mail <span className="text-red-400">*</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Ex: joao@email.com"
              required
              maxLength={254}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition placeholder:text-gray-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Telefone</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ex: (11) 98765-4321"
              maxLength={20}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition placeholder:text-gray-300"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdMusicNote size={15} />Instrumento e nível</h2>

          {/* Instrumento — 2 linhas de 4 + Outro */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Instrumento</label>
            <div className="grid grid-cols-4 gap-2">
              {INSTRUMENTS.map(inst => (
                <button
                  key={inst.value}
                  type="button"
                  onClick={() => setInstrument(inst.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition ${
                    instrument === inst.value
                      ? 'bg-[#153b50] text-white border-[#153b50]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#b2f0fb]'
                  }`}
                >
                  <inst.Icon size={20} />
                  <span className="leading-none">{inst.value}</span>
                </button>
              ))}
              {/* Outro — ocupa as 4 colunas restantes */}
              <button
                type="button"
                onClick={() => setInstrument('Outro')}
                className={`col-span-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-medium transition ${
                  instrument === 'Outro'
                    ? 'bg-[#153b50] text-white border-[#153b50]'
                    : 'bg-white text-gray-500 border-gray-200 border-dashed hover:border-[#b2f0fb]'
                }`}
              >
                <MdAdd size={15} />Outro instrumento
              </button>
            </div>
          </div>

          {/* Nível — 1 linha, 3 cards progressivos */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Nível <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map(lvl => {
                const active = level === lvl.value
                return (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => setLevel(lvl.value as typeof level)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition ${
                      active
                        ? 'bg-[#153b50] text-white border-[#153b50]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#b2f0fb]'
                    }`}
                  >
                    <lvl.Icon size={22} />
                    <span className="text-xs font-semibold leading-none">{lvl.label}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3].map(bar => (
                        <div key={bar} className={`w-3 h-1 rounded-full transition ${
                          bar <= lvl.bars
                            ? active ? 'bg-white' : 'bg-[#b2f0fb]'
                            : active ? 'bg-white/25' : 'bg-gray-200'
                        }`} />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdAccessTime size={15} />Disponibilidade semanal</h2>

          <div className="space-y-3">
            {availability.map((day) => (
              <div key={day.day} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleDay(day.day)}
                  className={`w-12 shrink-0 text-xs font-semibold py-1.5 rounded-lg border transition ${
                    day.active
                      ? 'bg-[#153b50] text-white border-[#153b50]'
                      : 'bg-white text-gray-400 border-gray-200'
                  }`}
                >
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
                      className="flex-1 accent-[#153b50]"
                    />
                    <span className="text-xs font-bold text-[#153b50] w-14 text-right shrink-0">
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
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Aluno iniciante, preferência por jazz"
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition resize-none placeholder:text-gray-300"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#153b50] hover:bg-[#153b50]/90 text-white rounded-xl h-10"
        >
          {loading ? 'Salvando...' : <span className="flex items-center gap-1.5 justify-center"><MdAdd size={16} />Cadastrar aluno e enviar convite</span>}
        </Button>

      </form>
    </TeacherLayout>
  )
}