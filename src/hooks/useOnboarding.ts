import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface OnboardingProgress {
  // Fluxo principal
  welcome_seen: boolean
  pieces_created: boolean
  program_created: boolean
  plan_approved: boolean
  onboarding_complete: boolean
  // Tours contextuais
  tour_mode_select_seen: boolean
  tour_planning_seen: boolean
  tour_today_seen: boolean
  tour_pomodoro_seen: boolean
  tour_repertoire_seen: boolean
  tour_teacher_seen: boolean
}

type OnboardingKey = keyof OnboardingProgress

const DEFAULT_PROGRESS: OnboardingProgress = {
  welcome_seen: false,
  pieces_created: false,
  program_created: false,
  plan_approved: false,
  onboarding_complete: false,
  tour_mode_select_seen: false,
  tour_planning_seen: false,
  tour_today_seen: false,
  tour_pomodoro_seen: false,
  tour_repertoire_seen: false,
  tour_teacher_seen: false,
}

export function useOnboarding() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<OnboardingProgress>(DEFAULT_PROGRESS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function loadOrCreate() {
      const { data } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()

      if (cancelled) return

      if (data) {
        setProgress(data as OnboardingProgress)
      } else {
        // First time — create row
        const { data: created } = await supabase
          .from('onboarding_progress')
          .insert({ user_id: user!.id })
          .select('*')
          .single()
        if (!cancelled && created) setProgress(created as OnboardingProgress)
      }
      setLoading(false)
    }

    loadOrCreate()
    return () => { cancelled = true }
  }, [user?.id])

  const markStep = useCallback(async (key: OnboardingKey) => {
    if (!user?.id) return
    setProgress(prev => ({ ...prev, [key]: true }))
    await supabase
      .from('onboarding_progress')
      .update({ [key]: true })
      .eq('user_id', user.id)
  }, [user?.id])

  const markComplete = useCallback(async () => {
    if (!user?.id) return
    const updates: Partial<OnboardingProgress> = {
      plan_approved: true,
      onboarding_complete: true,
    }
    setProgress(prev => ({ ...prev, ...updates }))
    await supabase
      .from('onboarding_progress')
      .update(updates)
      .eq('user_id', user.id)
  }, [user?.id])

  return { progress, loading, markStep, markComplete }
}
