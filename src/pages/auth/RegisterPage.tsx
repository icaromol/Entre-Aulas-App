import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteStudentId = searchParams.get('invite')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'teacher' | 'student'>(
    inviteStudentId ? 'student' : 'teacher'
  )
  const [inviteStudent, setInviteStudent] = useState<{ first_name: string; last_name: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!inviteStudentId) return
    supabase
      .from('students')
      .select('first_name, last_name, contact_email')
      .eq('id', inviteStudentId)
      .single()
      .then(({ data }) => {
        if (data) {
          setInviteStudent(data)
          setFirstName(data.first_name)
          setLastName(data.last_name)
          setEmail(data.contact_email ?? '')
        }
      })
  }, [inviteStudentId])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (inviteStudentId && data.user) {
      await supabase
        .from('students')
        .update({ profile_id: data.user.id })
        .eq('id', inviteStudentId)
    }

    if (role === 'teacher') {
      navigate('/professor')
    } else {
      navigate('/aluno')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Entre Aulas</h1>
          {inviteStudent ? (
            <p className="text-sm text-gray-500 mt-1">
              Olá, {inviteStudent.first_name}! Crie sua senha de acesso.
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">Crie sua conta</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleRegister} className="space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Nome</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="João"
                  required
                  readOnly={!!inviteStudentId}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition ${
                    inviteStudentId
                      ? 'bg-gray-50 border-gray-200 text-gray-400'
                      : 'border-gray-200 focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20'
                  }`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Sobrenome</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Silva"
                  required
                  readOnly={!!inviteStudentId}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition ${
                    inviteStudentId
                      ? 'bg-gray-50 border-gray-200 text-gray-400'
                      : 'border-gray-200 focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                readOnly={!!inviteStudentId}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition ${
                  inviteStudentId
                    ? 'bg-gray-50 border-gray-200 text-gray-400'
                    : 'border-gray-200 focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20'
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="repita a senha"
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition"
              />
            </div>

            {!inviteStudentId && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Você é</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['teacher', 'student'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 rounded-lg border text-sm font-medium transition ${
                        role === r
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]'
                      }`}
                    >
                      {r === 'teacher' ? 'Professor' : 'Aluno'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-lg h-9"
            >
              {loading ? 'Criando conta...' : inviteStudentId ? 'Criar minha senha' : 'Criar conta'}
            </Button>

          </form>
        </div>

        {!inviteStudentId && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{' '}
            <Link to="/login" className="text-[#4A90C4] font-medium hover:underline">
              Entrar
            </Link>
          </p>
        )}

      </div>
    </div>
  )
}