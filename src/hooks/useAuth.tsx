import { useContext, useEffect, useState, createContext, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Clarity from '@microsoft/clarity'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  role: 'teacher' | 'student'
  teacherId: string | null
  studentId: string | null
}

export type AppMode = 'teacher' | 'student'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  mode: AppMode | null
  setMode: (mode: AppMode) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  mode: null,
  setMode: () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setModeState] = useState<AppMode | null>(() => {
    const saved = sessionStorage.getItem('app_mode')
    return saved === 'teacher' || saved === 'student' ? saved : null
  })
  const fetchingRef = useRef<string | null>(null)

  function setMode(m: AppMode) {
    sessionStorage.setItem('app_mode', m)
    setModeState(m)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfile(session.user)
      else { setUser(null); setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(u: User) {
    // evita dupla busca (React StrictMode)
    if (fetchingRef.current === u.id) return
    fetchingRef.current = u.id

    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle()
    if (!data) { setUser(u); setProfile(null); setLoading(false); fetchingRef.current = null; return }

    let teacherId: string | null = null
    let studentId: string | null = null

    const [teacherRes, studentRes] = await Promise.all([
      data.role === 'teacher'
        ? supabase.from('teachers').select('id').eq('profile_id', u.id).single()
        : Promise.resolve({ data: null }),
      supabase.from('students').select('id').eq('profile_id', u.id).maybeSingle(),
    ])

    teacherId = (teacherRes.data as { id: string } | null)?.id ?? null
    studentId = (studentRes.data as { id: string } | null)?.id ?? null

    const fullProfile: Profile = { ...data, teacherId, studentId }
    Clarity.identify(u.id, undefined, undefined, `${data.first_name} ${data.last_name}`)
    Clarity.setTag('role', data.role)
    setUser(u)
    setProfile(fullProfile)
    setLoading(false)
    fetchingRef.current = null
  }

  async function signOut() {
    sessionStorage.removeItem('app_mode')
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, mode, setMode, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
