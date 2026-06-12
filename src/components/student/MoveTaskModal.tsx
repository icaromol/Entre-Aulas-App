import { MdClose } from "react-icons/md";
import { getDayFullLabel } from "@/lib/weekUtils";
import type { PlanItem } from "@/types/plan";

interface Props {
  item: PlanItem;
  todayDow: number;
  onClose: () => void;
  onMove: (item: PlanItem, newDow: number) => void;
}

// Ordem da semana: Seg=1 … Sáb=6, Dom=0
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function MoveTaskModal({ item, todayDow, onClose, onMove }: Props) {
  const todayIdx = WEEK_ORDER.indexOf(todayDow);
  // Dias restantes depois de hoje
  const remainingDows = WEEK_ORDER.slice(todayIdx + 1);

  const title =
    item.piece?.title ?? item.exercise?.title ?? "esta tarefa";

  if (remainingDows.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
          <p className="text-sm text-gray-500 text-center">
            Não há mais dias disponíveis nesta semana para mover a tarefa.
          </p>
          <button
            onClick={onClose}
            className="mt-4 w-full py-3 rounded-xl bg-[#153b50] text-white text-sm font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-base font-bold text-gray-800">Mover tarefa</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">
              {title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 transition text-gray-400"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Day list */}
        <div className="px-5 pb-6 flex flex-col gap-2">
          {remainingDows.map((dow, idx) => {
            const label =
              idx === 0
                ? `Amanhã — ${getDayFullLabel(dow)}`
                : getDayFullLabel(dow);

            return (
              <button
                key={dow}
                onClick={() => onMove(item, dow)}
                className="flex items-center w-full rounded-xl border border-gray-100 bg-[#f5f5f5] px-4 py-3.5 hover:border-[#b2f0fb] hover:bg-[#f5f5f5] transition text-left"
              >
                <p className="text-sm font-semibold text-[#153b50]">{label}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
