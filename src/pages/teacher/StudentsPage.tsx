import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MdAdd, MdMoreVert, MdCheckCircle, MdClose, MdEmail, MdContentCopy, MdCheck } from 'react-icons/md'
import { FaWhatsapp } from 'react-icons/fa'
import Avatar from 'boring-avatars'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

const AVATAR_COLORS = ['#1E3A5F', '#4A90C4', '#D6E4F0', '#F5F7FA', '#FFFFFF']

interface Student {
  id: string
  first_name: string
  last_name: string
  instrument: string
  level: string
  status: string
  contact_email: string | null
}

export default function StudentsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  const location = useLocation()
  const [inviteLink, setInviteLink] = useState<string | undefined>(location.state?.inviteLink)
  const [inviteStudentName, setInviteStudentName] = useState<string | undefined>(location.state?.studentName)
  const [inviteStudentEmail, setInviteStudentEmail] = useState<string | undefined>(location.state?.studentEmail)
  const [copied, setCopied] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  function handleCopy() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleInvite(student: Student) {
    const link = `${window.location.origin}/cadastro?invite=${student.id}`
    setInviteLink(link)
    setInviteStudentName(`${student.first_name} ${student.last_name}`)
    setInviteStudentEmail(student.contact_email ?? undefined)
    setCopied(false)
    setMenuOpenId(null)
  }

  function closeModal() {
    setInviteLink(undefined)
    setCopied(false)
  }

  function buildWhatsAppLink() {
    const msg = `Olá, ${inviteStudentName}! Você foi convidado para o *Entre Aulas* — sua plataforma exclusiva de acompanhamento musical 🎵\n\nLá você vai poder:\n• Ver as tarefas do dia\n• Estudar com o cronômetro Pomodoro\n• Acompanhar seu repertório e progresso\n• Registrar seu histórico de estudos\n\nAcesse o link e crie sua conta: ${inviteLink}`
    return `https://wa.me/?text=${encodeURIComponent(msg)}`
  }

  function buildMailtoLink() {
    const subject = `Convite para o Entre Aulas`
    const body = `Olá, ${inviteStudentName}!\n\nVocê foi convidado para o Entre Aulas — sua plataforma exclusiva de acompanhamento musical.\n\nLá você vai poder:\n- Ver as tarefas do dia\n- Estudar com o cronômetro Pomodoro\n- Acompanhar seu repertório e progresso\n- Registrar seu histórico de estudos\n\nAcesse o link e crie sua conta:\n${inviteLink}`
    return `mailto:${inviteStudentEmail ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function handleDeleteStudent(student: Student) {
    setMenuOpenId(null)
    if (!confirm(`Excluir ${student.first_name} ${student.last_name}? Esta ação não pode ser desfeita.`)) return
    await supabase.from('students').delete().eq('id', student.id)
    setStudents(prev => prev.filter(s => s.id !== student.id))
  }

  useEffect(() => {
    function handleClose() { setMenuOpenId(null) }
    document.addEventListener('click', handleClose)
    return () => document.removeEventListener('click', handleClose)
  }, [])

  useEffect(() => {
    if (profile) fetchStudents()
  }, [profile])

  async function fetchStudents() {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()

    if (!teacher) { setLoading(false); return }

    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, instrument, level, status, contact_email')
      .eq('teacher_id', teacher.id)
      .eq('status', 'active')
      .order('first_name')

    setStudents(data ?? [])
    setLoading(false)
  }

  const levelLabel: Record<string, string> = {
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
  }

  return (
    <TeacherLayout>
      {/* Modal de convite */}
      {inviteLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

            {/* Fechar */}
            <button onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
              <MdClose size={20} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <MdCheckCircle size={22} className="text-green-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1E3A5F]">{inviteStudentName} cadastrado!</h2>
                <p className="text-xs text-gray-400">Envie o acesso para o aluno</p>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Compartilhe o link abaixo para o aluno criar a senha e acessar a plataforma de acompanhamento musical.
            </p>

            {/* Link + copiar */}
            <div className="flex gap-2 mb-5">
              <input readOnly value={inviteLink}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500 outline-none min-w-0" />
              <button onClick={handleCopy}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#1E3A5F]/90 transition">
                {copied ? <><MdCheck size={14} />Copiado</> : <><MdContentCopy size={14} />Copiar</>}
              </button>
            </div>

            {/* Botões de envio */}
            <div className="grid grid-cols-2 gap-3">
              <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium transition">
                <FaWhatsapp size={17} />WhatsApp
              </a>
              <a href={buildMailtoLink()}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium transition">
                <MdEmail size={17} />E-mail
              </a>
            </div>

          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Alunos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {students.length} {students.length === 1 ? 'aluno ativo' : 'alunos ativos'}
          </p>
        </div>
        <Link to="/professor/alunos/novo">
          <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-sm">
            <MdAdd size={16} className="inline -mt-0.5 mr-0.5" />Novo aluno
          </Button>
        </Link>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">Nenhum aluno cadastrado ainda.</p>
          <Link to="/professor/alunos/novo">
            <Button className="mt-4 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-sm">
              Cadastrar primeiro aluno
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {students.map(student => (
            <div
              key={student.id}
              className="relative bg-white rounded-2xl border border-gray-100 hover:border-[#4A90C4] transition px-5 py-4 flex items-center gap-4 group"
            >
              {/* Área clicável → perfil */}
              <Link
                to={`/professor/alunos/${student.id}`}
                className="flex items-center gap-4 flex-1 min-w-0"
              >
                <div className="shrink-0 rounded-full overflow-hidden">
                  <Avatar
                    size={40}
                    name={`${student.first_name} ${student.last_name}`}
                    variant="beam"
                    colors={AVATAR_COLORS}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {student.instrument} · {levelLabel[student.level] ?? student.level}
                  </p>
                </div>
              </Link>

              {/* 3-dot menu */}
              <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpenId(menuOpenId === student.id ? null : student.id)}
                  className={`w-8 h-8 rounded-lg transition flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 ${
                    menuOpenId === student.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Mais opções"
                >
                  <MdMoreVert size={18} />
                </button>
                {menuOpenId === student.id && (
                  <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-48 z-20">
                    <button
                      onClick={() => { setMenuOpenId(null); navigate(`/professor/alunos/${student.id}/planejamento`) }}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-[#1E3A5F] hover:bg-[#D6E4F0] transition"
                    >
                      Novo planejamento
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => { setMenuOpenId(null); navigate(`/professor/alunos/${student.id}`) }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
                    >
                      Informações
                    </button>
                    <button
                      onClick={() => handleInvite(student)}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
                    >
                      Criar convite
                    </button>
                    <button
                      onClick={() => { setMenuOpenId(null); navigate(`/professor/alunos/${student.id}/editar`) }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
                    >
                      Editar
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => handleDeleteStudent(student)}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition"
                    >
                      Excluir aluno
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </TeacherLayout>
  )
}
