import { MdCheckCircle } from "react-icons/md"

interface ContinuityCardProps {
  onDismiss: () => void
}

export function ContinuityCard({ onDismiss }: ContinuityCardProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
      <div
        className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center text-center"
        style={{ width: "80%" }}
      >
        <div className="w-12 h-12 rounded-full bg-[#153b50] flex items-center justify-center mb-4">
          <MdCheckCircle size={24} color="white" />
        </div>

        <p className="text-sm font-bold text-[#153b50]">
          Tudo certo por aqui
        </p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          Algumas tarefas não foram concluídas, mas não se preocupe — já reorganizamos seu planejamento automaticamente.
        </p>

        <button
          onClick={onDismiss}
          className="mt-5 w-full py-2.5 rounded-xl bg-[#153b50] text-white text-xs font-semibold hover:bg-[#153b50]/90 transition"
        >
          Entendi
        </button>
      </div>
    </div>
  )
}
