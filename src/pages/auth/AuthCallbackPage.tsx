import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface PendingSignup {
  type: 'login' | 'signup'
  role?: 'teacher' | 'student'
  inviteStudentId?: string
  firstName?: string
  lastName?: string
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    async function processUser(user: User) {
      const raw = sessionStorage.getItem('pending_signup')
      const pending: PendingSignup = raw ? JSON.parse(raw) : { type: 'login' }
      sessionStorage.removeItem('pending_signup')

      if (pending.type === 'signup' && pending.role) {
        const googleName = user.user_metadata?.full_name ?? ''
        const firstName = pending.firstName
          || user.user_metadata?.given_name
          || googleName.split(' ')[0]
          || ''
        const lastName = pending.lastName
          || user.user_metadata?.family_name
          || googleName.split(' ').slice(1).join(' ')
          || ''

        await supabase.rpc('complete_user_profile', {
          p_role:       pending.role,
          p_first_name: firstName,
          p_last_name:  lastName,
          p_avatar_url: user.user_metadata?.avatar_url ?? null,
        })

        if (pending.inviteStudentId) {
          await supabase
            .from('students')
            .update({ profile_id: user.id })
            .eq('id', pending.inviteStudentId)
            .is('profile_id', null)
        }
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'teacher') {
        navigate('/professor/alunos', { replace: true })
      } else if (profile?.role === 'student') {
        navigate('/aluno/hoje', { replace: true })
      } else {
        navigate('/cadastro', { replace: true, state: { autoSignup: true } })
      }
    }

    // Usar onAuthStateChange em vez de getSession() para garantir
    // que os tokens do hash/code da URL já foram processados
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        subscription.unsubscribe()
        processUser(session.user)
      } else if (event === 'INITIAL_SESSION' && !session) {
        navigate('/login', { replace: true })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <img src="/estudamus_logo.png" alt="estudamus" className="h-10 opacity-80" />
      <div className="w-6 h-6 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
