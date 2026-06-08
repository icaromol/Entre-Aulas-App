import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Clarity from '@microsoft/clarity'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  role: 'teacher' | 'student'
}

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  })

  useEffect(() => {
    // Busca sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user)
      } else {
        setState({ user: null, profile: null, loading: false })
      }
    })

    // Escuta mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchProfile(session.user)
        } else {
          setState({ user: null, profile: null, loading: false })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(user: User) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      setState({ user, profile: null, loading: false })
    } else {
      const profile = data as Profile
      Clarity.identify(user.id, undefined, undefined, `${profile.first_name} ${profile.last_name}`)
      Clarity.setTag('role', profile.role)
      setState({ user, profile, loading: false })
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { ...state, signOut }
}