import { useMemo, useState } from "react";
import {
  MdMusicNote,
  MdFitnessCenter,
  MdClose,
  MdGpsFixed,
  MdCalendarToday,
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

  const preSelected = useMemo<FocusOption | null>(() => {
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

  const options = buildOptions(items);

  const [selectedKey, setSelectedKey] = useState<string | null>(
    hasPreSelection && preSelected ? preSelected.key : null,
  );

  const selectedOption =
    options.find((o) => o.key === selectedKey) ?? preSelected;

  function handleApply(scope: "day" | "week") {
    if (!selectedOption) return;
    onApply(scope, selectedOption.pieceId, selectedOption.exerciseId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="text-base font-bold text-gray-800">Dar um foco especial?</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 transition text-gray-400"
          >
            <MdClose size={20} />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Visual antes → depois */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#F5F7FA] rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Antes</p>
              <div className="space-y-1.5">
                {[["Peça A", 25], ["Peça B", 25]].map(([label, min]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <div className="h-5 rounded-md bg-[#4A90C4]/30 flex items-center justify-center flex-1">
                      <span className="text-[10px] font-medium text-[#1E3A5F]">{label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{min}m</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[#4A90C4] text-lg font-bold shrink-0">→</div>

            <div className="flex-1 bg-[#F5F7FA] rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Com foco</p>
              <div className="space-y-1.5">
                {[["Peça A ⭐", 35, true], ["Peça B", 15, false]].map(([label, min, focus]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <div className={`h-5 rounded-md flex items-center justify-center flex-1 ${focus ? "bg-[#1E3A5F]" : "bg-[#4A90C4]/20"}`}>
                      <span className={`text-[10px] font-medium ${focus ? "text-white" : "text-[#1E3A5F]"}`}>{label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{min}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de itens — oculta se já há pré-seleção */}
          {!hasPreSelection && (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {options.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">
                  Nenhum item disponível para focar hoje.
                </p>
              ) : (
                options.map((opt) => {
                  const Icon = opt.type === "piece" ? MdMusicNote : MdFitnessCenter;
                  const active = selectedKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setSelectedKey(active ? null : opt.key)}
                      className={`flex items-center gap-3 w-full rounded-xl border-2 px-4 py-3 transition text-left ${
                        active
                          ? "border-[#1E3A5F] bg-[#D6E4F0]"
                          : "border-gray-100 bg-[#F5F7FA] hover:border-[#4A90C4]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-[#1E3A5F]" : "bg-[#4A90C4]/30"}`}>
                        <Icon size={16} color={active ? "white" : "#1E3A5F"} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{opt.title}</p>
                        {opt.subtitle && (
                          <p className="text-xs text-gray-400 truncate">{opt.subtitle}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Item pré-selecionado destacado */}
          {hasPreSelection && preSelected && (
            <div className="flex items-center gap-3 rounded-xl border-2 border-[#1E3A5F] bg-[#D6E4F0] px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                {preSelected.type === "piece"
                  ? <MdMusicNote size={16} color="white" />
                  : <MdFitnessCenter size={16} color="white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{preSelected.title}</p>
                {preSelected.subtitle && (
                  <p className="text-xs text-gray-400 truncate">{preSelected.subtitle}</p>
                )}
              </div>
            </div>
          )}

          {/* Botões de escopo */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleApply("day")}
              disabled={!selectedOption}
              className="flex-1 flex flex-col items-center gap-1 rounded-xl border-2 border-[#D6E4F0] bg-[#F5F7FA] px-3 py-3 hover:border-[#1E3A5F] hover:bg-[#D6E4F0] transition disabled:opacity-40 disabled:pointer-events-none"
            >
              <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center">
                <MdGpsFixed size={16} color="white" />
              </div>
              <p className="text-xs font-semibold text-[#1E3A5F]">Foco do Dia</p>
              <p className="text-[10px] text-gray-400 text-center leading-tight">Redistribui o tempo hoje</p>
            </button>
            <button
              onClick={() => handleApply("week")}
              disabled={!selectedOption}
              className="flex-1 flex flex-col items-center gap-1 rounded-xl border-2 border-[#D6E4F0] bg-[#F5F7FA] px-3 py-3 hover:border-[#4A90C4] hover:bg-[#D6E4F0] transition disabled:opacity-40 disabled:pointer-events-none"
            >
              <div className="w-8 h-8 rounded-full bg-[#4A90C4] flex items-center justify-center">
                <MdCalendarToday size={16} color="white" />
              </div>
              <p className="text-xs font-semibold text-[#1E3A5F]">Foco da Semana</p>
              <p className="text-[10px] text-gray-400 text-center leading-tight">Prioriza nos dias restantes</p>
            </button>
          </div>
        </div>
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
