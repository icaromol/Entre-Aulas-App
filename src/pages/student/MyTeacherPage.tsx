import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from 'boring-avatars'
import { toast } from 'sonner'
import { MdArrowBack, MdSchool } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'

import { AVATAR_COLORS } from '@/lib/colors'

interface TeacherInfo {
  first_name: string
  last_name: string
  avatar_url: string | null
  email?: string
}

type ConnectionState = 'loading' | 'none' | 'pending' | 'connected'

export default function MyTeacherPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [connState, setConnState]   = useState<ConnectionState>('loading')
  const [teacher, setTeacher]       = useState<TeacherInfo | null>(null)
  const [teacherEmail, setTeacherEmail] = useState('')
  const [requesting, setRequesting]     = useState(false)
  const [cooldown, setCooldown]         = useState(0)
  const [disconnecting, setDisconnecting] = useState(false)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setConnState('loading')
    const { data, error } = await supabase.rpc('get_my_teacher_info')
    if (error) { setConnState('none'); return }

    const res = data as { state: string; first_name?: string; last_name?: string; avatar_url?: string | null }

    if (res.state === 'pending') {
      setConnState('pending')
    } else if (res.state === 'connected') {
      setTeacher({ first_name: res.first_name ?? '', last_name: res.last_name ?? '', avatar_url: res.avatar_url ?? null })
      setConnState('connected')
    } else {
      setConnState('none')
    }
  }

  async function handleRequest() {
    if (!teacherEmail.trim() || cooldown > 0) return
    setRequesting(true)
    const { data, error } = await supabase.rpc('request_teacher_connection', {
      p_teacher_email: teacherEmail.trim(),
    })
    setRequesting(false)
    if (error || (data as { error?: string })?.error) {
      const code = (data as { error?: string })?.error
      const msg = code === 'professor_not_found' ? 'Professor não encontrado nesta plataforma.'
                : code === 'not_a_teacher'       ? 'Este e-mail não pertence a um professor.'
                : code === 'already_connected'   ? 'Você já enviou uma solicitação para este professor.'
                : code === 'rate_limited'         ? 'Muitas tentativas. Aguarde alguns minutos.'
                : 'Erro ao enviar. Tente novamente.'
      toast.error(msg)
      startCooldown()
      return
    }
    setTeacherEmail('')
    setConnState('pending')
    toast.success('Solicitação enviada!')
  }

  function startCooldown() {
    setCooldown(30)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

  async function handleDisconnect() {
    if (!confirm('Desconectar do professor? Seu histórico e repertório serão preservados.')) return
    setDisconnecting(true)
    await supabase.rpc('disconnect_from_teacher')
    setDisconnecting(false)
    setTeacher(null)
    setConnState('none')
    toast.success('Desconectado do professor.')
  }

  async function handleCancelRequest() {
    if (!confirm('Cancelar a solicitação?')) return
    await supabase.rpc('disconnect_from_teacher')
    setConnState('none')
  }

  return (
    <StudentLayout>
      {/* Cabeçalho da página */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:border-[#b2f0fb] hover:text-[#153b50] transition"
        >
          <MdArrowBack size={18} />
        </button>
        <h1 className="text-lg font-bold text-[#153b50]">Meu professor</h1>
      </div>

      {/* Loading */}
      {connState === 'loading' && (
        <div className="flex justify-center py-12"><Spinner /></div>
      )}

      {/* Sem professor */}
      {connState === 'none' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-4">
              <MdSchool size={32} className="text-[#153b50]" />
            </div>
            <h2 className="text-base font-bold text-[#153b50] mb-1">Nenhum professor vinculado</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Você está usando o estudamus de forma independente.
              Conecte-se a um professor para receber planejamentos e acompanhamento.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs text-gray-400 font-medium">E-mail do professor (opcional)</label>
            <input
              type="email"
              value={teacherEmail}
              onChange={e => setTeacherEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRequest()}
              placeholder="professor@email.com"
              maxLength={254}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#b2f0fb] transition"
            />
            <button
              onClick={handleRequest}
              disabled={requesting || !teacherEmail.trim() || cooldown > 0}
              className="w-full py-3 rounded-xl bg-[#153b50] text-white text-sm font-semibold hover:bg-[#153b50]/90 transition disabled:opacity-40"
            >
              {requesting ? 'Enviando...' : cooldown > 0 ? `Aguarde ${cooldown}s` : 'Solicitar conexão'}
            </button>
          </div>
        </div>
      )}

      {/* Solicitação pendente */}
      {connState === 'pending' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#f5f5f5] flex items-center justify-center">
            <MdSchool size={32} className="text-[#b2f0fb]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#153b50] mb-1">Solicitação enviada</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Aguardando o professor aceitar sua solicitação de conexão.
            </p>
          </div>
          <button
            onClick={handleCancelRequest}
            className="text-sm text-red-400 hover:text-red-600 transition underline"
          >
            Cancelar solicitação
          </button>
        </div>
      )}

      {/* Professor conectado */}
      {connState === 'connected' && teacher && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center text-center gap-5">
          <div className="rounded-full overflow-hidden">
            <Avatar
              size={72}
              name={`${teacher.first_name} ${teacher.last_name}`}
              variant="beam"
              colors={AVATAR_COLORS}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#153b50]">
              {teacher.first_name} {teacher.last_name}
            </h2>
            <p className="text-xs text-gray-400 mt-1">Professor</p>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="mt-2 px-6 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition disabled:opacity-40"
          >
            {disconnecting ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      )}
    </StudentLayout>
  )
}
