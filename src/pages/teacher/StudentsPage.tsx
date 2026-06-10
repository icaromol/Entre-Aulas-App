import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdAdd, MdMoreVert, MdCheckCircle, MdClose, MdEmail, MdContentCopy, MdCheck,
  MdPersonAdd, MdPersonSearch,
} from 'react-icons/md'
import { FaWhatsapp } from 'react-icons/fa'
import Avatar from 'boring-avatars'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
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
  invite_token: string | null
  profile_id: string | null
}

export default function StudentsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents]       = useState<Student[]>([])
  const [pending, setPending]         = useState<Student[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string | null>(null)

  const location = useLocation()
  const [inviteLink, setInviteLink]               = useState<string | undefined>(location.state?.inviteLink)
  const [inviteStudentName, setInviteStudentName] = useState<string | undefined>(location.state?.studentName)
  const [inviteStudentEmail, setInviteStudentEmail] = useState<string | undefined>(location.state?.studentEmail)
  const [copied, setCopied]           = useState(false)
  const [menuOpenId, setMenuOpenId]   = useState<string | null>(null)

  // Buscar aluno existente
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkEmail, setLinkEmail]         = useState('')
  const [linking, setLinking]             = useState(false)

  function handleCopy() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleInvite(student: Student) {
    const link = `${window.location.origin}/cadastro?invite=${student.id}&token=${student.invite_token ?? ''}`
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
    const msg = `Olá, ${inviteStudentName}! Você foi convidado para o *estudamus* — sua plataforma exclusiva de acompanhamento musical 🎵\n\nLá você vai poder:\n• Ver as tarefas do dia\n• Estudar com o cronômetro Pomodoro\n• Acompanhar seu repertório e progresso\n• Registrar seu histórico de estudos\n\nAcesse o link e crie sua conta: ${inviteLink}`
    return `https://wa.me/?text=${encodeURIComponent(msg)}`
  }

  function buildMailtoLink() {
    const subject = `Convite para o estudamus`
    const body = `Olá, ${inviteStudentName}!\n\nVocê foi convidado para o estudamus — sua plataforma exclusiva de acompanhamento musical.\n\nLá você vai poder:\n- Ver as tarefas do dia\n- Estudar com o cronômetro Pomodoro\n- Acompanhar seu repertório e progresso\n- Registrar seu histórico de estudos\n\nAcesse o link e crie sua conta:\n${inviteLink}`
    return `mailto:${inviteStudentEmail ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function handleDisconnectStudent(student: Student) {
    setMenuOpenId(null)
    if (student.profile_id) {
      // Aluno já tem conta — apenas desconecta (preserva dados)
      if (!confirm(`Desconectar ${student.first_name} ${student.last_name}? O histórico e repertório dele serão preservados.`)) return
      const { error } = await supabase
        .from('students')
        .update({ teacher_id: null })
        .eq('id', student.id)
      if (error) { toast.error('Erro ao desconectar aluno.'); return }
    } else {
      // Aluno nunca aceitou o convite — pode excluir o registro
      if (!confirm(`Excluir ${student.first_name} ${student.last_name}? O aluno ainda não criou conta, o registro será removido.`)) return
      const { error } = await supabase.from('students').delete().eq('id', student.id)
      if (error) { toast.error('Erro ao excluir aluno.'); return }
    }
    setStudents(prev => prev.filter(s => s.id !== student.id))
    toast.success(student.profile_id ? 'Aluno desconectado.' : 'Aluno removido.')
  }

  async function handleRenewInvite(student: Student) {
    setMenuOpenId(null)
    const newToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('students')
      .update({ invite_token: newToken, invite_expires_at: expiresAt })
      .eq('id', student.id)
    if (error) { toast.error('Erro ao renovar convite.'); return }
    // Atualiza localmente e abre modal com novo link
    setStudents(prev => prev.map(s => s.id === student.id ? { ...s, invite_token: newToken } : s))
    const link = `${window.location.origin}/cadastro?invite=${student.id}&token=${newToken}`
    setInviteLink(link)
    setInviteStudentName(`${student.first_name} ${student.last_name}`)
    setInviteStudentEmail(student.contact_email ?? undefined)
    setCopied(false)
    toast.success('Novo convite gerado!')
  }

  async function handleAccept(student: Student) {
    const { error } = await supabase.rpc('accept_student_request', { p_student_id: student.id })
    if (error) { toast.error('Erro ao aceitar solicitação.'); return }
    setPending(prev => prev.filter(s => s.id !== student.id))
    setStudents(prev => [...prev, { ...student, status: 'active' }].sort((a, b) =>
      a.first_name.localeCompare(b.first_name)
    ))
    toast.success(`${student.first_name} adicionado como aluno!`)
  }

  async function handleDecline(student: Student) {
    if (!confirm(`Recusar solicitação de ${student.first_name} ${student.last_name}?`)) return
    await supabase.from('students').delete().eq('id', student.id)
    setPending(prev => prev.filter(s => s.id !== student.id))
    toast.success('Solicitação recusada.')
  }

  async function handleLinkExisting() {
    if (!linkEmail.trim()) return
    setLinking(true)
    const { data, error } = await supabase.rpc('link_existing_student', {
      p_student_email: linkEmail.trim(),
    })
    setLinking(false)
    if (error || (data as { error?: string })?.error) {
      const code = (data as { error?: string })?.error
      const msg = code === 'user_not_found'    ? 'Nenhuma conta encontrada com este e-mail.'
                : code === 'not_a_student'     ? 'Este e-mail pertence a um professor, não a um aluno.'
                : code === 'already_connected' ? 'Este aluno já está na sua lista.'
                : 'Erro ao vincular aluno.'
      toast.error(msg)
      return
    }
    const res = data as { success: boolean; first_name: string; last_name: string }
    setShowLinkModal(false)
    setLinkEmail('')
    toast.success(`${res.first_name} ${res.last_name} adicionado!`)
    fetchStudents()
  }

  useEffect(() => {
    function handleClose() { setMenuOpenId(null) }
    document.addEventListener('click', handleClose)
    return () => document.removeEventListener('click', handleClose)
  }, [])

  useEffect(() => {
    if (profile?.teacherId) fetchStudents()
  }, [profile?.teacherId])

  async function fetchStudents() {
    const teacherId = profile!.teacherId!

    const [activeRes, pendingRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, first_name, last_name, instrument, level, status, contact_email, invite_token, profile_id')
        .eq('teacher_id', teacherId)
        .eq('status', 'active')
        .order('first_name'),
      supabase
        .from('students')
        .select('id, first_name, last_name, instrument, level, status, contact_email, invite_token, profile_id')
        .eq('teacher_id', teacherId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    if (activeRes.error || pendingRes.error) {
      console.error('[StudentsPage] fetch failed:', activeRes.error ?? pendingRes.error)
      setFetchError('Não foi possível carregar os alunos. Tente recarregar a página.')
      setLoading(false)
      return
    }

    setStudents(activeRes.data ?? [])
    setPending(pendingRes.data ?? [])
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
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
              <MdClose size={20} />
            </button>
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
              Compartilhe o link abaixo para o aluno criar a senha e acessar a plataforma.
            </p>
            <div className="flex gap-2 mb-5">
              <input readOnly value={inviteLink}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500 outline-none min-w-0" />
              <button onClick={handleCopy}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#1E3A5F]/90 transition">
                {copied ? <><MdCheck size={14} />Copiado</> : <><MdContentCopy size={14} />Copiar</>}
              </button>
            </div>
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

      {/* Modal buscar aluno existente */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowLinkModal(false); setLinkEmail('') }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <button onClick={() => { setShowLinkModal(false); setLinkEmail('') }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
              <MdClose size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#D6E4F0] flex items-center justify-center shrink-0">
                <MdPersonSearch size={22} className="text-[#1E3A5F]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1E3A5F]">Vincular aluno existente</h2>
                <p className="text-xs text-gray-400">Aluno que já tem conta no estudamus</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs text-gray-400 font-medium">E-mail do aluno</label>
              <input
                type="email"
                value={linkEmail}
                onChange={e => setLinkEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLinkExisting()}
                placeholder="aluno@email.com"
                maxLength={254}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#4A90C4] transition"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowLinkModal(false); setLinkEmail('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-[#4A90C4] transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleLinkExisting}
                disabled={linking || !linkEmail.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#1E3A5F]/90 transition disabled:opacity-40"
              >
                {linking ? 'Buscando...' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Meus alunos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {students.length} {students.length === 1 ? 'aluno ativo' : 'alunos ativos'}
            {pending.length > 0 && ` · ${pending.length} solicitação${pending.length > 1 ? 'ões' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLinkModal(true)}
            title="Vincular aluno existente"
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:border-[#4A90C4] hover:text-[#1E3A5F] transition"
          >
            <MdPersonSearch size={18} />
          </button>
          <Link to="/professor/alunos/novo">
            <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-sm">
              <MdAdd size={16} className="inline -mt-0.5 mr-0.5" />Novo aluno
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : fetchError ? (
        <p className="text-sm text-red-500 text-center py-12">{fetchError}</p>
      ) : (
        <div className="space-y-6">

          {/* Solicitações pendentes */}
          {pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MdPersonAdd size={16} className="text-[#4A90C4]" />
                <h2 className="text-sm font-semibold text-gray-500">Solicitações pendentes</h2>
                <span className="ml-auto text-xs bg-[#4A90C4] text-white px-2 py-0.5 rounded-full font-medium">
                  {pending.length}
                </span>
              </div>
              <div className="grid gap-2">
                {pending.map(student => (
                  <div key={student.id}
                    className="bg-[#D6E4F0]/40 border border-[#4A90C4]/30 rounded-2xl px-5 py-4 flex items-center gap-4">
                    <div className="shrink-0 rounded-full overflow-hidden">
                      <Avatar size={40} name={`${student.first_name} ${student.last_name}`} variant="beam" colors={AVATAR_COLORS} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{student.contact_email}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleDecline(student)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition"
                        title="Recusar"
                      >
                        <MdClose size={16} />
                      </button>
                      <button
                        onClick={() => handleAccept(student)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/90 transition"
                        title="Aceitar"
                      >
                        <MdCheck size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de alunos ativos */}
          {students.length === 0 && pending.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <p className="text-gray-400 text-sm">Nenhum aluno cadastrado ainda.</p>
              <Link to="/professor/alunos/novo">
                <Button className="mt-4 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-sm">
                  Cadastrar primeiro aluno
                </Button>
              </Link>
            </div>
          ) : students.length > 0 ? (
            <div id="onboarding-teacher-students">
              {pending.length > 0 && (
                <p className="text-sm font-semibold text-gray-500 mb-3">Ativos</p>
              )}
              <div className="grid gap-3">
                {students.map(student => (
                  <div key={student.id}
                    className="relative bg-white rounded-2xl border border-gray-100 hover:border-[#4A90C4] transition px-5 py-4 flex items-center gap-4 group">
                    <Link to={`/professor/alunos/${student.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="shrink-0 rounded-full overflow-hidden">
                        <Avatar size={40} name={`${student.first_name} ${student.last_name}`} variant="beam" colors={AVATAR_COLORS} />
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

                    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === student.id ? null : student.id)}
                        className={`w-8 h-8 rounded-lg transition flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 ${
                          menuOpenId === student.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <MdMoreVert size={18} />
                      </button>
                      {menuOpenId === student.id && (
                        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-48 z-20">
                          <button onClick={() => { setMenuOpenId(null); navigate(`/professor/alunos/${student.id}/planejamento`) }}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-[#1E3A5F] hover:bg-[#D6E4F0] transition">
                            Novo planejamento
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button onClick={() => { setMenuOpenId(null); navigate(`/professor/alunos/${student.id}`) }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition">
                            Informações
                          </button>
                          <button onClick={() => handleInvite(student)}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition">
                            Enviar convite
                          </button>
                          {!student.profile_id && (
                            <button onClick={() => handleRenewInvite(student)}
                              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition">
                              Renovar convite
                            </button>
                          )}
                          <button onClick={() => { setMenuOpenId(null); navigate(`/professor/alunos/${student.id}/editar`) }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition">
                            Editar
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button onClick={() => handleDisconnectStudent(student)}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition">
                            {student.profile_id ? 'Desconectar aluno' : 'Excluir aluno'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </TeacherLayout>
  )
}
