import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface PendingSignup {
  type: 'login' | 'signup'
  role?: 'teacher' | 'student'
  inviteStudentId?: string
  inviteToken?: string
  firstName?: string
  lastName?: string
  instrument?: string
  instruments?: string[]
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

        if (pending.inviteStudentId && pending.inviteToken) {
          await supabase
            .from('students')
            .update({ profile_id: user.id, invite_token: null })
            .eq('id', pending.inviteStudentId)
            .eq('invite_token', pending.inviteToken)
            .is('profile_id', null)
            .gt('invite_expires_at', new Date().toISOString())
        } else if (pending.role === 'student') {
          await supabase.from('students').insert({
            profile_id:    user.id,
            teacher_id:    null,
            first_name:    firstName,
            last_name:     lastName,
            contact_email: user.email,
            instrument:    pending.instrument || null,
            status:        'active',
          })
        } else if (pending.role === 'teacher') {
          if (pending.instruments && pending.instruments.length > 0) {
            await supabase.from('teachers').update({ instruments: pending.instruments.join(', ') }).eq('profile_id', user.id)
          }
        }
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.role === 'teacher') {
        const savedMode = sessionStorage.getItem('app_mode')
        if (savedMode === 'student') {
          window.location.replace('/aluno/planejamento')
        } else if (savedMode === 'teacher') {
          window.location.replace('/professor/jornada')
        } else {
          window.location.replace('/modo')
        }
      } else if (profile?.role === 'student') {
        window.location.replace('/aluno/planejamento')
      } else {
        window.location.replace('/cadastro?auto=1')
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        subscription.unsubscribe()
        processUser(session.user)
      } else if (event === 'INITIAL_SESSION' && !session) {
        window.location.replace('/login')
      }
    })

    // Fallback: se o onAuthStateChange não disparar em 8s, redireciona pro login
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      window.location.replace('/login')
    }, 8000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <img src="/logo_estudamus_horizontal_dark_blue@3x.png" alt="estudamus" className="h-10 opacity-80" />
      <div className="w-6 h-6 border-2 border-[#153b50] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
