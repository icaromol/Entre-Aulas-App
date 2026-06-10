import { type ReactNode } from 'react'
import { NextStepReact } from 'nextstepjs'
import { useNavigate, useLocation } from 'react-router-dom'
import { OnboardingCard } from './OnboardingCard'
import { ONBOARDING_TOURS } from '@/lib/onboardingTours'
import { useOnboarding } from '@/hooks/useOnboarding'
import type { NavigationAdapter } from 'nextstepjs'
import type { OnboardingProgress } from '@/hooks/useOnboarding'
import { useMemo } from 'react'

// UX 4 fix: mapeamento de nome de tour → chave de progresso
const TOUR_TO_KEY: Partial<Record<string, keyof OnboardingProgress>> = {
  tour_mode_select: 'tour_mode_select_seen',
  tour_planning:    'tour_planning_seen',
  tour_today:       'tour_today_seen',
  tour_pomodoro:    'tour_pomodoro_seen',
  tour_repertoire:  'tour_repertoire_seen',
  tour_teacher:     'tour_teacher_seen',
}

function useReactRouterAdapter(): NavigationAdapter {
  const navigate = useNavigate()
  const location = useLocation()
  // ARCH 4 fix: useMemo para não recriar objeto a cada render
  return useMemo(() => ({
    push: (path: string) => navigate(path),
    getCurrentPath: () => location.pathname,
  }), [navigate, location.pathname])
}

interface Props {
  children: ReactNode
}

export function OnboardingTourProvider({ children }: Props) {
  const { markStep } = useOnboarding()

  function handleTourEnd(tourName: string | null) {
    if (!tourName) return
    const key = TOUR_TO_KEY[tourName]
    if (key) markStep(key)
  }

  return (
    <NextStepReact
      steps={ONBOARDING_TOURS}
      cardComponent={OnboardingCard}
      shadowRgb="0, 0, 0"
      shadowOpacity="0.4"
      navigationAdapter={useReactRouterAdapter}
      onComplete={handleTourEnd}
      onSkip={(_, tourName) => handleTourEnd(tourName)}
    >
      {children}
    </NextStepReact>
  )
}
