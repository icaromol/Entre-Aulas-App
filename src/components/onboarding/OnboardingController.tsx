import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNextStep } from 'nextstepjs'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useOnboarding } from '@/hooks/useOnboarding'
import { supabase } from '@/lib/supabase'
import { autoGeneratePlan } from '@/lib/autoplan'
import { Spinner } from '@/components/ui/Spinner'
import { WelcomeModal } from './WelcomeModal'
import { PiecesSetupModal } from './PiecesSetupModal'
import { AvailabilitySetupModal } from './AvailabilitySetupModal'

type StudentStep = 'welcome' | 'availability' | 'pieces' | 'done'
type TeacherStep = 'welcome' | 'done'

// Tour names that map to progress keys in useOnboarding
const STUDENT_TOURS: { tour: string; path: string; key: string }[] = [
  { tour: 'tour_today',      path: '/aluno/planejamento', key: 'tour_today_seen'      },
  { tour: 'tour_pomodoro',   path: '/aluno/pomodoro',     key: 'tour_pomodoro_seen'   },
  { tour: 'tour_repertoire', path: '/aluno/repertorio',   key: 'tour_repertoire_seen' },
]

function StudentOnboarding() {
  const { user } = useAuth()
  const { progress, loading, markStep } = useOnboarding()
  const { startNextStep } = useNextStep()
  const navigate = useNavigate()
  const location = useLocation()

  const [localStep, setLocalStep] = useState<StudentStep>('done')
  // students.id (FK em pieces) — diferente de profiles.id
  const [realStudentId, setRealStudentId] = useState<string | null>(null)
  const [hasAvailability, setHasAvailability] = useState<boolean | null>(null)

  // BUG 1 fix: toda lógica de setState dentro de useEffect
  useEffect(() => {
    if (loading) return
    if (!progress.welcome_seen) {
      setLocalStep('welcome')
    } else if (!progress.pieces_created) {
      setLocalStep('pieces')
    } else {
      setLocalStep('done')
    }
  }, [loading, progress.welcome_seen, progress.pieces_created])

  // ARCH 1 + BUG 2 fix: detecção de tour em useEffect separado que reage a pathname
  useEffect(() => {
    if (loading || !progress.pieces_created) return
    const match = STUDENT_TOURS.find(t => t.path === location.pathname)
    if (!match) return
    const alreadySeen = progress[match.key as keyof typeof progress]
    if (alreadySeen) return
    const id = setTimeout(() => startNextStep(match.tour), 600)
    return () => clearTimeout(id)
  }, [location.pathname, loading, progress, startNextStep])

  // Fetch students.id + verificar disponibilidade quando for mostrar o modal de peças
  useEffect(() => {
    if (localStep !== 'pieces' || !user?.id) return
    supabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .single()
      .then(async ({ data }) => {
        if (!data) return
        setRealStudentId(data.id)
        const { data: avail } = await supabase
          .from('student_availability')
          .select('id')
          .eq('student_id', data.id)
          .eq('is_active', true)
          .limit(1)
        const has = (avail ?? []).length > 0
        setHasAvailability(has)
        if (!has) setLocalStep('availability')
      })
  }, [localStep, user?.id])

  if (loading || localStep === 'done') return null

  if (localStep === 'welcome') {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
        <WelcomeModal
          onStart={async () => {
            await markStep('welcome_seen')
            setLocalStep('pieces')
          }}
        />
      </>
    )
  }

  // Sem dias disponíveis — mostrar editor de disponibilidade antes das peças
  if (localStep === 'availability' && realStudentId) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
        <AvailabilitySetupModal
          studentId={realStudentId}
          onDone={() => {
            setHasAvailability(true)
            setLocalStep('pieces')
          }}
        />
      </>
    )
  }

  if (localStep === 'pieces') {
    // Aguardando fetch do studentId ou checagem de disponibilidade
    if (!realStudentId || hasAvailability === null) {
      return (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <Spinner size={28} />
          </div>
        </>
      )
    }

    return (
      <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
        <PiecesSetupModal
          studentId={realStudentId}
          onDone={async () => {
            await markStep('pieces_created')
            await markStep('program_created')
            setLocalStep('done')
            const result = await autoGeneratePlan(realStudentId)
            if (result.ok) {
              toast.success('Seu plano está pronto! Bons estudos!')
              navigate('/aluno/planejamento')
            } else {
              navigate('/aluno/planejamento')
            }
          }}
        />
      </>
    )
  }

  return null
}

function TeacherOnboarding() {
  const { progress, loading, markStep } = useOnboarding()
  const { startNextStep } = useNextStep()
  const location = useLocation()

  const [localStep, setLocalStep] = useState<TeacherStep>('done')

  // BUG 1 fix: setState em useEffect
  useEffect(() => {
    if (loading) return
    if (!progress.welcome_seen) {
      setLocalStep('welcome')
    } else {
      setLocalStep('done')
    }
  }, [loading, progress.welcome_seen])

  // ARCH 1 fix: tour contextual reage a pathname, não a resolved
  useEffect(() => {
    if (loading || !progress.welcome_seen) return
    if (!progress.tour_teacher_seen && location.pathname.startsWith('/professor')) {
      const id = setTimeout(() => startNextStep('tour_teacher'), 600)
      return () => clearTimeout(id)
    }
  }, [location.pathname, loading, progress.welcome_seen, progress.tour_teacher_seen, startNextStep])

  if (loading || localStep === 'done') return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
      <WelcomeModal
        onStart={async () => {
          await markStep('welcome_seen')
          setLocalStep('done')
        }}
      />
    </>
  )
}

interface OnboardingControllerProps {
  role: 'student' | 'teacher'
}

export function OnboardingController({ role }: OnboardingControllerProps) {
  return role === 'student' ? <StudentOnboarding /> : <TeacherOnboarding />
}
