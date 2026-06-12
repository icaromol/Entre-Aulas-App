import { useRef, useState } from "react";
import { MdAdd } from "react-icons/md";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { OnboardingStepper } from "@/components/ui/OnboardingStepper";
import { DEFAULT_CHECKLIST } from "@/lib/defaultChecklist";

interface Props {
  studentId: string; // students.id (não profiles.id)
  onDone: () => void;
}

export function PiecesSetupModal({ studentId, onDone }: Props) {
  const [names, setNames] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, value: string) {
    setNames((prev) => {
      const next = [...prev];
      next[index] = value;
      // Append new empty field when typing in the last one — foco fica no campo atual
      if (index === prev.length - 1 && value.trim() !== "") {
        next.push("");
      }
      return next;
    });
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
    if (e.key === "Backspace" && names[index] === "" && names.length > 1) {
      e.preventDefault();
      setNames((prev) => {
        const next = prev.filter((_, i) => i !== index);
        inputRefs.current = inputRefs.current.slice(0, next.length);
        return next;
      });
      setTimeout(() => inputRefs.current[index - 1]?.focus(), 0);
    }
  }

  const filled = names.filter((n) => n.trim() !== "");

  async function handleSubmit() {
    if (filled.length === 0) {
      toast.error("Digite pelo menos uma peça.");
      return;
    }
    setSaving(true);
    try {
      const { data: piecesData, error: pErr } = await supabase
        .from("pieces")
        .insert(
          filled.map((title) => ({
            student_id: studentId,
            title: title.trim(),
            status: "in_progress",
            difficulty: 5,
          })),
        )
        .select("id");

      if (pErr) throw pErr;

      // Inserir checklist padrão para cada peça criada
      if (piecesData && piecesData.length > 0) {
        const checklistRows = piecesData.flatMap((piece: { id: string }) =>
          DEFAULT_CHECKLIST.map((item) => ({
            piece_id: piece.id,
            title: item.title,
            category: item.category,
            position: item.position,
            is_optional: item.is_optional,
          })),
        );
        await supabase.from("checklist_items").insert(checklistRows);
      }

      const { error: progErr } = await supabase.from("programas").insert({
        student_id: studentId,
        title: "Aulas Regulares",
        type: "regular",
        status: "active",
      });

      if (progErr) throw progErr;

      toast.success(
        `${filled.length} ${filled.length === 1 ? "peça criada" : "peças criadas"}!`,
      );
      onDone();
    } catch {
      toast.error("Erro ao criar peças. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
        {/* Stepper header */}
        <div className="px-7 pt-6 pb-4 border-b border-gray-100">
          <OnboardingStepper totalSteps={3} currentStep={2} />
        </div>

        {/* Title */}
        <div className="px-7 pt-5 pb-5">
          <h2 className="text-base font-bold text-[#153b50]">
            Quais peças você está estudando?
          </h2>
          <p className="text-xs text-gray-400 mt-2">
            Digite o nome de cada peça. Pressione Enter para avançar.
          </p>
        </div>

        {/* Fields — scrollable */}
        <div className="flex-1 overflow-y-auto px-7 py-2 space-y-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-300 w-4 text-right shrink-0">
                {i + 1}
              </span>
              <input
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition placeholder:text-gray-300"
                placeholder={
                  i === 0
                    ? "Ex: Sonatina Op.36 nº1"
                    : i === 1
                      ? "Ex: Für Elise"
                      : "Mais uma peça..."
                }
                value={name}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
                disabled={saving}
              />
            </div>
          ))}

          {filled.length > 0 && names[names.length - 1] !== "" && (
            <button
              onClick={() => {
                const nextIdx = names.length;
                setNames((prev) => [...prev, ""]);
                setTimeout(() => inputRefs.current[nextIdx]?.focus(), 0);
              }}
              className="flex items-center gap-1.5 text-xs text-[#b2f0fb] hover:text-[#153b50] transition pl-6 py-1"
            >
              <MdAdd size={14} /> Adicionar mais
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={saving || filled.length === 0}
            className="w-full py-3 rounded-xl bg-[#153b50] text-white font-semibold text-sm hover:bg-[#153b50]/90 transition disabled:opacity-50"
          >
            {saving ? "Criando..." : `Continuar →`}
          </button>
          <p className="text-[11px] text-gray-400 text-center mt-2">
            Sempre que quiser, você pode adicionar mais peças
          </p>
        </div>
      </div>
    </div>
  );
}
