import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { FcGoogle } from 'react-icons/fc'
import { MdPerson, MdSchool } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

type Role = 'teacher' | 'student'

const ROLES: { value: Role; label: string; desc: string; Icon: typeof MdPerson }[] = [
  { value: 'teacher', label: 'Professor',          desc: 'Gerencio alunos e repertório',          Icon: MdSchool },
  { value: 'student', label: 'Estudante', desc: 'Estudo e organizo meu próprio repertório', Icon: MdPerson },
]

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const inviteStudentId = searchParams.get('invite')
  const inviteToken     = searchParams.get('token')
  const autoSignup = (location.state as { autoSignup?: boolean } | null)?.autoSignup ?? searchParams.get('auto') === '1'

  const [inviteStudent, setInviteStudent] = useState<{ first_name: string; last_name: string } | null>(null)
  const [inviteInvalid, setInviteInvalid] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!inviteStudentId || !inviteToken) {
      if (inviteStudentId) setInviteInvalid(true) // tem id mas não tem token
      return
    }
    supabase
      .from('students')
      .select('first_name, last_name')
      .eq('id', inviteStudentId)
      .eq('invite_token', inviteToken)
      .is('profile_id', null)
      .gt('invite_expires_at', new Date().toISOString())
      .single()
      .then(({ data }) => {
        if (data) setInviteStudent(data)
        else setInviteInvalid(true)
      })
  }, [inviteStudentId, inviteToken])

  // Fluxo: usuário já autenticado via Google mas sem profile → escolhe role aqui
  async function handleDirectSignup() {
    if (!selectedRole) return
    setError('')
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { navigate('/login', { replace: true }); return }

    const user = session.user
    const googleName = user.user_metadata?.full_name ?? ''
    const firstName = user.user_metadata?.given_name || googleName.split(' ')[0] || ''
    const lastName  = user.user_metadata?.family_name || googleName.split(' ').slice(1).join(' ') || ''

    const { error: rpcErr } = await supabase.rpc('complete_user_profile', {
      p_role:       selectedRole,
      p_first_name: firstName,
      p_last_name:  lastName,
      p_avatar_url: user.user_metadata?.avatar_url ?? null,
    })

    if (rpcErr) {
      setError('Erro ao criar perfil. Tente novamente.')
      setLoading(false)
      return
    }

    if (selectedRole === 'student') {
      await supabase.from('students').insert({
        profile_id:    user.id,
        teacher_id:    null,
        first_name:    firstName,
        last_name:     lastName,
        contact_email: user.email,
        status:        'active',
      })
    }

    navigate(selectedRole === 'teacher' ? '/professor/alunos' : '/aluno/hoje', { replace: true })
  }

  // Fluxo normal: OAuth Google
  async function handleGoogleSignup() {
    if (!inviteStudentId && !selectedRole) return
    setError('')
    setLoading(true)

    const role: Role = inviteStudentId ? 'student' : selectedRole!
    const pending = inviteStudentId
      ? { type: 'signup' as const, role, inviteStudentId, inviteToken: inviteToken ?? '', firstName: inviteStudent?.first_name, lastName: inviteStudent?.last_name }
      : { type: 'signup' as const, role }

    sessionStorage.setItem('pending_signup', JSON.stringify(pending))

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError('Não foi possível conectar com o Google. Tente novamente.')
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const subtitle = autoSignup
    ? 'Sua conta Google foi conectada. Como quer usar o estudamus?'
    : inviteStudentId
      ? inviteInvalid
        ? 'Link de convite inválido ou expirado.'
        : inviteStudent
          ? `Olá, ${inviteStudent.first_name}! Crie sua conta para acessar o estudamus.`
          : 'Verificando convite...'
      : 'Criar conta'

  const canProceed = inviteStudentId ? (!!inviteStudent && !inviteInvalid) : !!selectedRole

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <img src="/estudamus_logo.png" alt="estudamus" className="h-10 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          {/* Seleção de role — cadastro normal ou autoSignup */}
          {!inviteStudentId && (
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRole(value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition text-center ${
                    selectedRole === value
                      ? 'border-[#1E3A5F] bg-[#D6E4F0]'
                      : 'border-gray-200 bg-white hover:border-[#4A90C4]'
                  }`}
                >
                  <Icon size={28} className={selectedRole === value ? 'text-[#1E3A5F]' : 'text-gray-400'} />
                  <span className={`text-sm font-semibold ${selectedRole === value ? 'text-[#1E3A5F]' : 'text-gray-600'}`}>{label}</span>
                  <span className="text-xs text-gray-400 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Botão */}
          {inviteStudentId && !inviteStudent ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : autoSignup ? (
            <Button
              onClick={handleDirectSignup}
              disabled={loading || !canProceed}
              className="w-full h-11 rounded-xl bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white disabled:opacity-40"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                : 'Continuar'}
            </Button>
          ) : (
            <Button
              onClick={handleGoogleSignup}
              disabled={loading || !canProceed}
              variant="outline"
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border-gray-200 text-gray-700 hover:border-[#4A90C4] hover:bg-gray-50 transition disabled:opacity-40"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <FcGoogle size={20} />}
              {loading ? 'Redirecionando...' : 'Continuar com Google'}
            </Button>
          )}
        </div>

        {!inviteStudentId && !autoSignup && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{' '}
            <Link to="/login" className="text-[#4A90C4] font-medium hover:underline">Entrar</Link>
          </p>
        )}

      </div>
    </div>
  )
}
