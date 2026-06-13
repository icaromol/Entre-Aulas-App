import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FcGoogle } from 'react-icons/fc'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    setError('')
    setLoading(true)
    sessionStorage.setItem('pending_signup', JSON.stringify({ type: 'login' }))
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError('Não foi possível conectar com o Google. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <img src="/logo_estudamus_horizontal_dark_blue.svg" alt="estudamus" className="h-[50px] mx-auto mb-6" />
          <p className="text-sm text-gray-500">Acesse sua conta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {error && <p className="text-sm text-red-500 mb-4 text-center">{error}</p>}

          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="outline"
            className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border-gray-200 text-gray-700 hover:border-[#b2f0fb] hover:bg-gray-50 transition"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FcGoogle size={20} />
            )}
            {loading ? 'Redirecionando...' : 'Entrar com Google'}
          </Button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Primeira vez?{' '}
          <Link to="/cadastro" className="text-[#b2f0fb] font-medium hover:underline">
            Criar conta
          </Link>
        </p>

      </div>
    </div>
  )
}
