import type { CardComponentProps } from 'nextstepjs'
import { MdArrowBack, MdArrowForward, MdClose } from 'react-icons/md'

export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-5 w-72 relative">
      {arrow}

      {/* Skip button */}
      <button
        onClick={() => skipTour?.()}
        className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 transition"
        aria-label="Fechar tour"
      >
        <MdClose size={16} />
      </button>

      {/* Step dots */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`block h-1.5 rounded-full transition-all ${
              i === currentStep
                ? 'w-4 bg-[#1E3A5F]'
                : i < currentStep
                  ? 'w-1.5 bg-[#4A90C4]'
                  : 'w-1.5 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Icon + title */}
      {step.icon && (
        <div className="text-2xl mb-2">{step.icon}</div>
      )}
      <h3 className="text-sm font-bold text-[#1E3A5F] mb-1.5">{step.title}</h3>
      <div className="text-xs text-gray-500 leading-relaxed mb-4">{step.content}</div>

      {/* Controls */}
      {step.showControls !== false && (
        <div className="flex gap-2">
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:border-[#4A90C4] transition"
            >
              <MdArrowBack size={12} /> Voltar
            </button>
          )}
          <button
            onClick={nextStep}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#1E3A5F]/90 transition"
          >
            {currentStep === totalSteps - 1 ? 'Concluir' : 'Próximo'}
            {currentStep < totalSteps - 1 && <MdArrowForward size={12} />}
          </button>
        </div>
      )}
    </div>
  )
}
