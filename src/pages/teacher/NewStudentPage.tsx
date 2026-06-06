import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MdArrowBack, MdPerson, MdMusicNote, MdAccessTime, MdNotes, MdAdd } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

const INSTRUMENTS = [
  'Violão', 'Guitarra', 'Baixo', 'Piano', 'Teclado',
  'Violino', 'Viola', 'Violoncelo', 'Flauta', 'Saxofone',
  'Trompete', 'Bateria', 'Percussão', 'Canto', 'Outro',
]

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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
    DAYS.map((_, i) => ({ day: i, active: false, minutes: 30 }))
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

      // 2. Verifica se o e-mail já existe
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('contact_email', email)
        .single()

      if (existingStudent) {
        throw new Error('Este e-mail já está cadastrado para outro aluno.')
      }

      // 3. Cria o aluno
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
        .select('id')
        .single()

      if (studentError || !student) throw new Error('Erro ao criar aluno.')

      // 4. Salva disponibilidade
      const availabilityRows = availability.map(d => ({
        student_id: student.id,
        day_of_week: d.day,
        is_active: d.active,
        minutes_available: d.active ? d.minutes : null,
      }))

      await supabase.from('student_availability').insert(availabilityRows)

      // 5. Gera link de convite e redireciona
      const inviteLink = `${window.location.origin}/cadastro?invite=${student.id}`
      toast.success('Aluno cadastrado com sucesso!')
      navigate('/professor/alunos', { state: { inviteLink, studentName: firstName } })

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const levelOptions = [
    { value: 'beginner', label: 'Iniciante' },
    { value: 'intermediate', label: 'Intermediário' },
    { value: 'advanced', label: 'Avançado' },
  ]

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/professor/alunos" className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Novo aluno</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl mx-auto">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdPerson size={15} />Dados pessoais</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Nome</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="João"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Sobrenome</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Silva"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">E-mail (para convite)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="aluno@email.com"
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Telefone (opcional)</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdMusicNote size={15} />Instrumento</h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Instrumento</label>
            <select
              value={instrument}
              onChange={e => setInstrument(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition bg-white"
            >
              <option value="">Selecione...</option>
              {INSTRUMENTS.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Nível</label>
            <div className="flex gap-2">
              {levelOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLevel(opt.value as typeof level)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition ${
                    level === opt.value
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600"><MdAccessTime size={15} />Disponibilidade semanal</h2>

          <div className="space-y-2">
            {availability.map((day) => (
              <div key={day.day} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleDay(day.day)}
                  className={`w-12 text-xs font-semibold py-1.5 rounded-lg border transition ${
                    day.active
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-gray-400 border-gray-200'
                  }`}
                >
                  {DAYS[day.day]}
                </button>

                {day.active && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      value={day.minutes}
                      onChange={e => setMinutes(day.day, Number(e.target.value))}
                      min={5}
                      max={240}
                      step={5}
                      className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition text-center"
                    />
                    <span className="text-xs text-gray-400">minutos</span>
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
            placeholder="Anotações sobre o aluno..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl h-10"
        >
          {loading ? 'Salvando...' : <span className="flex items-center gap-1.5 justify-center"><MdAdd size={16} />Cadastrar aluno e enviar convite</span>}
        </Button>

      </form>
    </TeacherLayout>
  )
}