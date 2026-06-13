import { OnboardingStepper } from "@/components/ui/OnboardingStepper";

interface Props {
  onStart: () => void;
}

export function WelcomeModal({ onStart }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          width: "min(90vw, 480px)",
          height: "min(80vh, 520px)",
          minWidth: "300px",
        }}
      >
        {/* Stepper header */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-100">
          <OnboardingStepper totalSteps={3} currentStep={1} />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
          <img
            src="/logo_estudamus_horizontal_dark_blue@3x.png"
            alt="Estudamus"
            className="h-7 object-contain mb-7"
          />
          <h1 className="text-2xl font-bold text-[#153b50] mb-3">
            Bem-vindo ao Estudamus!
          </h1>
          <p className="text-base text-gray-500 leading-relaxed max-w-sm">
            Vamos configurar seus estudos em{" "}
            <strong className="text-[#153b50]">poucos passos simples</strong>.
            Leva menos de um minuto.
          </p>
        </div>

        {/* Footer */}
        <div className="px-10 pb-8">
          <button
            onClick={onStart}
            className="w-full py-3 rounded-xl bg-[#153b50] text-white font-semibold text-sm hover:bg-[#153b50]/90 transition"
          >
            Começar →
          </button>
        </div>
      </div>
    </div>
  );
}
