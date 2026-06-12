import { useState } from "react";
import { MdClose } from "react-icons/md";

interface Props {
  currentMinutes: number;
  itemTitle: string;
  onClose: () => void;
  onSaveThis: (minutes: number) => void;
  onSaveAll: (minutes: number) => void;
}

export function EditDurationModal({
  currentMinutes,
  itemTitle,
  onClose,
  onSaveThis,
  onSaveAll,
}: Props) {
  const [value, setValue] = useState(String(currentMinutes));

  const minutes = Math.max(1, parseInt(value) || 0);
  const valid = minutes > 0 && minutes !== currentMinutes;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-8 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-base font-bold text-gray-800">Editar tempo</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{itemTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 transition text-gray-400"
          >
            <MdClose size={20} />
          </button>
        </div>

        <div className="px-5 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <input
              type="number"
              min={1}
              max={240}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 text-center text-2xl font-bold text-[#1E3A5F] border-2 border-[#D6E4F0] rounded-xl py-2 focus:outline-none focus:border-[#4A90C4]"
            />
            <span className="text-sm text-gray-400">minutos</span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              disabled={!valid}
              onClick={() => onSaveThis(minutes)}
              className="w-full py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-40 transition"
            >
              Salvar só este item
            </button>
            <button
              disabled={!valid}
              onClick={() => onSaveAll(minutes)}
              className="w-full py-3 rounded-xl border-2 border-[#1E3A5F] text-[#1E3A5F] text-sm font-semibold disabled:opacity-40 transition"
            >
              Salvar e redistribuir os outros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
