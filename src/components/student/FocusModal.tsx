import { useMemo, useState } from "react";
import {
  MdMusicNote,
  MdFitnessCenter,
  MdClose,
  MdArrowBack,
  MdGpsFixed,
} from "react-icons/md";
import type { PlanItem } from "@/types/plan";

interface FocusOption {
  key: string;
  type: "piece" | "exercise";
  title: string;
  subtitle: string;
  pieceId: string | null;
  exerciseId: string | null;
}

interface Props {
  items: PlanItem[];
  preSelectedPieceId?: string | null;
  preSelectedExerciseId?: string | null;
  onClose: () => void;
  onApply: (
    scope: "day" | "week",
    pieceId: string | null,
    exerciseId: string | null,
  ) => void;
}

export function FocusModal({
  items,
  preSelectedPieceId,
  preSelectedExerciseId,
  onClose,
  onApply,
}: Props) {
  const hasPreSelection = !!(preSelectedPieceId || preSelectedExerciseId);

  const [step, setStep] = useState<"scope" | "pick">("scope");
  const [scope, setScope] = useState<"day" | "week" | null>(null);

  const selected = useMemo<FocusOption | null>(() => {
    if (preSelectedPieceId) {
      const item = items.find((i) => i.piece_id === preSelectedPieceId);
      if (item?.piece)
        return {
          key: `piece-${preSelectedPieceId}`,
          type: "piece",
          title: item.piece.title,
          subtitle: item.piece.composer ?? "Peça",
          pieceId: preSelectedPieceId,
          exerciseId: null,
        };
    }
    if (preSelectedExerciseId) {
      const item = items.find((i) => i.exercise_id === preSelectedExerciseId);
      if (item?.exercise)
        return {
          key: `exercise-${preSelectedExerciseId}`,
          type: "exercise",
          title: item.exercise.title,
          subtitle: categoryLabel(item.exercise.category),
          pieceId: null,
          exerciseId: preSelectedExerciseId,
        };
    }
    return null;
  }, [preSelectedPieceId, preSelectedExerciseId, items]);

  // Deduplica itens por piece_id / exercise_id
  const options = buildOptions(items);

  function handleScopeSelect(s: "day" | "week") {
    setScope(s);
    if (hasPreSelection && selected) {
      onApply(s, selected.pieceId, selected.exerciseId);
    } else {
      setStep("pick");
    }
  }

  function handleOptionSelect(opt: FocusOption) {
    if (scope) {
      onApply(scope, opt.pieceId, opt.exerciseId);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            {step === "pick" && (
              <button
                onClick={() => setStep("scope")}
                className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
              >
                <MdArrowBack size={20} />
              </button>
            )}
            <p className="text-base font-bold text-gray-800">
              {step === "scope" ? "Dar um foco especial?" : "O que você quer focar?"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 transition text-gray-400"
          >
            <MdClose size={20} />
          </button>
        </div>

        {step === "scope" ? (
          <div className="px-5 pb-6">
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              {hasPreSelection && selected
                ? `Quer dar mais atenção a "${selected.title}" hoje ou durante toda a semana?`
                : "Está a fim de dar mais atenção a algo hoje ou nesta semana?"}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleScopeSelect("day")}
                className="flex items-center gap-4 w-full rounded-xl border-2 border-[#D6E4F0] bg-[#F5F7FA] px-4 py-4 hover:border-[#4A90C4] hover:bg-[#D6E4F0] transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                  <MdGpsFixed size={20} color="white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1E3A5F]">
                    Foco do Dia
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Redistribui o tempo só para hoje
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleScopeSelect("week")}
                className="flex items-center gap-4 w-full rounded-xl border-2 border-[#D6E4F0] bg-[#F5F7FA] px-4 py-4 hover:border-[#4A90C4] hover:bg-[#D6E4F0] transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#4A90C4] flex items-center justify-center shrink-0">
                  <MdGpsFixed size={20} color="white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1E3A5F]">
                    Foco da Semana
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Prioriza esse conteúdo nos dias restantes
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-6">
            {options.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Nenhum item disponível para focar hoje.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {options.map((opt) => {
                  const Icon = opt.type === "piece" ? MdMusicNote : MdFitnessCenter;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleOptionSelect(opt)}
                      className="flex items-center gap-3 w-full rounded-xl border border-gray-100 bg-[#F5F7FA] px-4 py-3 hover:border-[#4A90C4] hover:bg-[#D6E4F0] transition text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                        <Icon size={16} color="white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {opt.title}
                        </p>
                        {opt.subtitle && (
                          <p className="text-xs text-gray-400 truncate">
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function buildOptions(items: PlanItem[]): FocusOption[] {
  const seen = new Set<string>();
  const result: FocusOption[] = [];

  for (const item of items) {
    if (item.is_done) continue;

    if (item.piece_id && item.piece) {
      const key = `piece-${item.piece_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          key,
          type: "piece",
          title: item.piece.title,
          subtitle: item.piece.composer ?? "Peça",
          pieceId: item.piece_id,
          exerciseId: null,
        });
      }
    }

    if (item.exercise_id && item.exercise) {
      const key = `exercise-${item.exercise_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          key,
          type: "exercise",
          title: item.exercise.title,
          subtitle: categoryLabel(item.exercise.category),
          pieceId: null,
          exerciseId: item.exercise_id,
        });
      }
    }
  }

  return result;
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    technique: "Técnica",
    ear_training: "Percepção",
    harmony: "Harmonia",
    history: "História",
    improvisation: "Improvisação",
    other: "Outro",
  };
  return map[category] ?? category;
}
