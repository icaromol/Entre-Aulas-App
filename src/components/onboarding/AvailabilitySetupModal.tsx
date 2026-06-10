import { OnboardingStepper } from '@/components/ui/OnboardingStepper'
import { AvailabilityEditor } from '@/components/ui/AvailabilityEditor'

interface Props {
  studentId: string
  onDone: () => void
}

export function AvailabilitySetupModal({ studentId, onDone }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
        {/* Stepper header */}
        <div className="px-7 pt-6 pb-4 border-b border-gray-100">
          <OnboardingStepper totalSteps={3} currentStep={2} />
        </div>

        {/* Title */}
        <div className="px-7 pt-5 pb-3">
          <h2 className="text-base font-bold text-[#1E3A5F]">
            Quando você costuma estudar?
          </h2>
          <p className="text-xs text-gray-400 mt-2">
            Marque os dias e quanto tempo você tem disponível. O planejamento vai respeitar sua rotina.
          </p>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-7 py-2">
          <AvailabilityEditor
            studentId={studentId}
            onSaved={(hasAny) => { if (hasAny) onDone() }}
            alwaysExpanded
          />
        </div>

        <div className="px-7 py-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 text-center">
            Você pode ajustar isso a qualquer momento nas configurações.
          </p>
        </div>
      </div>
    </div>
  )
}
