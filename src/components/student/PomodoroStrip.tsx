import { useNavigate } from "react-router-dom";
import { PomodoroIcon } from "@/components/ui/PomodoroIcon";

interface Props {
  totalPoms: number;
  studiedPoms: number;
}

export function PomodoroStrip({ totalPoms, studiedPoms }: Props) {
  const navigate = useNavigate();

  if (totalPoms === 0) return null;

  const SIZE = 50;
  const GAP = 8;
  const doneFull = Math.floor(studiedPoms);

  return (
    <div className="w-full flex flex-col items-center mt-20 gap-4">
      <button
        onClick={() => navigate("/aluno/planejamento")}
        className="w-full flex flex-wrap justify-center cursor-pointer"
        style={{ gap: GAP }}
      >
        {Array.from({ length: totalPoms }).map((_, i) => (
          <PomodoroIcon
            key={i}
            fill={Math.min(1, Math.max(0, studiedPoms - i))}
            size={SIZE}
          />
        ))}
      </button>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-[#1E3A5F] leading-none">{doneFull}</span>
        <span className="text-sm text-gray-400">/{totalPoms} pomodoros</span>
      </div>
    </div>
  );
}
