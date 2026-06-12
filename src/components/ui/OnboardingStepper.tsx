// Stepper horizontal para os modais de onboarding.
// Cores: cinza (inactive) → azul claro #b2f0fb (completed) → azul escuro #153b50 (active)

interface OnboardingStepperProps {
  totalSteps: number
  currentStep: number  // 1-based
}

export function OnboardingStepper({ totalSteps, currentStep }: OnboardingStepperProps) {
  const ACTIVE    = '#153b50'
  const COMPLETED = '#b2f0fb'
  const INACTIVE  = '#E5E7EB'

  function getColor(stepNumber: number) {
    if (stepNumber < currentStep) return COMPLETED
    if (stepNumber === currentStep) return ACTIVE
    return INACTIVE
  }

  function getConnectorColor(stepNumber: number) {
    // Connector after stepNumber is completed-color if that step is done
    return stepNumber < currentStep ? COMPLETED : INACTIVE
  }

  return (
    <div className="flex items-center justify-center w-full">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0 transition-all duration-300"
            style={{ backgroundColor: getColor(step) }}
          />
          {step < totalSteps && (
            <div
              className="w-8 h-0.5 transition-all duration-300"
              style={{ backgroundColor: getConnectorColor(step) }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
