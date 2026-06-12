import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Avatar from "boring-avatars";
import { MdAdd, MdMusicNote, MdFitnessCenter, MdSettings, MdCheckBox, MdCheckBoxOutlineBlank } from "react-icons/md";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import { Switch } from "@/components/ui/switch";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { autoGeneratePlan } from "@/lib/autoplan";
const AVATAR_COLORS = ["#1E3A5F", "#4A90C4", "#D6E4F0", "#F5F7FA", "#FFFFFF"];

interface ChecklistItem {
  id: string;
  title: string;
  category: string | null;
  position: number;
  is_optional: boolean;
}

interface Piece {
  id: string;
  title: string;
  composer: string | null;
  status: string;
  completion_pct: number;
  checklist_items: ChecklistItem[];
  is_in_maintenance: boolean;
}

interface Exercise {
  id: string;
  title: string;
  category: string;
  status: string;
}

const categoryLabel: Record<string, string> = {
  technique: "Técnica",
  ear_training: "Percepção musical",
  harmony: "Harmonia",
  history: "História da música",
  improvisation: "Improvisação",
  other: "Outro",
};


type TabKey = "pieces" | "exercises";

export default function RepertoirePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam === "exercises" ? tabParam : "pieces",
  );

  const [pieces, setPieces] = useState<Piece[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"pieces" | "exercises" | null>(
    null,
  );
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    context: "piece_active" | "piece_maintenance" | "exercise";
    piece?: Piece;
    exercise?: Exercise;
    checked: boolean;
  } | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{ type: "status"; value: string; label: string } | { type: "delete"; label: string } | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<"delete" | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  function requestPieceToggle(piece: Piece, checked: boolean) {
    const context =
      piece.status === "completed" ? "piece_maintenance" : "piece_active";
    const key =
      context === "piece_maintenance"
        ? "repertoire_maintenance_warned"
        : "repertoire_toggle_warned";
    if (localStorage.getItem(key)) {
      handlePieceToggle(piece, checked);
    } else {
      setDontShowAgain(false);
      setPendingToggle({ context, piece, checked });
    }
  }

  function requestExerciseToggle(exercise: Exercise, checked: boolean) {
    if (localStorage.getItem("repertoire_toggle_warned")) {
      handleExerciseToggle(exercise, checked);
    } else {
      setDontShowAgain(false);
      setPendingToggle({ context: "exercise", exercise, checked });
    }
  }

  function confirmToggle() {
    if (!pendingToggle) return;
    const key =
      pendingToggle.context === "piece_maintenance"
        ? "repertoire_maintenance_warned"
        : "repertoire_toggle_warned";
    if (dontShowAgain) localStorage.setItem(key, "1");
    if (pendingToggle.exercise)
      handleExerciseToggle(pendingToggle.exercise, pendingToggle.checked);
    else if (pendingToggle.piece)
      handlePieceToggle(pendingToggle.piece, pendingToggle.checked);
    setPendingToggle(null);
  }

  async function handlePieceToggle(piece: Piece, checked: boolean) {
    if (!studentId) return;
    const update =
      piece.status === "completed"
        ? { is_in_maintenance: checked }
        : { status: checked ? "in_progress" : "paused" };

    setPieces((prev) =>
      prev.map((p) => (p.id === piece.id ? { ...p, ...update } : p)),
    );

    const { error } = await supabase
      .from("pieces")
      .update(update)
      .eq("id", piece.id);
    if (error) {
      setPieces((prev) => prev.map((p) => (p.id === piece.id ? piece : p)));
      toast.error("Erro ao atualizar peça.");
      return;
    }
    autoGeneratePlan(studentId);
  }

  async function handleExerciseToggle(exercise: Exercise, checked: boolean) {
    if (!studentId) return;
    const update = { status: checked ? "active" : "inactive" };
    setExercises((prev) =>
      prev.map((e) => (e.id === exercise.id ? { ...e, ...update } : e)),
    );
    const { error } = await supabase
      .from("exercises")
      .update(update)
      .eq("id", exercise.id);
    if (error) {
      setExercises((prev) =>
        prev.map((e) => (e.id === exercise.id ? exercise : e)),
      );
      toast.error("Erro ao atualizar exercício.");
      return;
    }
    autoGeneratePlan(studentId);
  }

  function switchTab(tab: TabKey) {
    exitSelectionMode();
    setActiveTab(tab);
    setSearchParams({ tab });
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setShowStatusMenu(false);
    setSelectedAction(null);
    setConfirmBulkAction(null);
  }

  function toggleSelectionMode() {
    if (isSelectionMode) {
      exitSelectionMode();
    } else {
      setIsSelectionMode(true);
      setSelectedIds(new Set());
    }
  }

  function toggleItemSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkStatusChange(newStatus: string) {
    if (selectedIds.size === 0 || !studentId) return;
    setShowStatusMenu(false);
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const table = activeTab === "pieces" ? "pieces" : "exercises";
    const { error } = await supabase.from(table).update({ status: newStatus }).in("id", ids);
    if (error) {
      toast.error("Erro ao alterar status.");
      setBulkLoading(false);
      return;
    }
    if (activeTab === "pieces") {
      setPieces((prev) => prev.map((p) => selectedIds.has(p.id) ? { ...p, status: newStatus } : p));
    } else {
      setExercises((prev) => prev.map((e) => selectedIds.has(e.id) ? { ...e, status: newStatus } : e));
    }
    autoGeneratePlan(studentId);
    toast.success(`Status atualizado para ${ids.length} item(ns).`);
    setBulkLoading(false);
    exitSelectionMode();
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0 || !studentId) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const table = activeTab === "pieces" ? "pieces" : "exercises";
    const { error } = await supabase.from(table).delete().in("id", ids);
    if (error) {
      toast.error("Erro ao excluir itens.");
      setBulkLoading(false);
      setConfirmBulkAction(null);
      return;
    }
    if (activeTab === "pieces") {
      setPieces((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    } else {
      setExercises((prev) => prev.filter((e) => !selectedIds.has(e.id)));
    }
    autoGeneratePlan(studentId);
    toast.success(`${ids.length} item(ns) excluído(s).`);
    setBulkLoading(false);
    setConfirmBulkAction(null);
    exitSelectionMode();
  }

  function parseNames(text: string): string[] {
    return text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleImport() {
    if (!studentId || !importMode) return;
    const names = parseNames(importText);
    if (names.length === 0) return;
    setImporting(true);
    if (importMode === "pieces") {
      const { data } = await supabase
        .from("pieces")
        .insert(
          names.map((title) => ({
            student_id: studentId,
            title,
            status: "in_progress",
            difficulty: 6,
          })),
        )
        .select("id, title, composer, status, completion_pct");
      setPieces((prev) => [
        ...prev,
        ...(data ?? []).map((p: any) => ({ ...p, checklist_items: [] })),
      ]);
    } else {
      const { data } = await supabase
        .from("exercises")
        .insert(
          names.map((title) => ({
            student_id: studentId,
            title,
            category: "technique",
            status: "active",
            difficulty: 6,
          })),
        )
        .select("id, title, category, status");
      setExercises((prev) => [...prev, ...(data ?? [])]);
    }
    setImportText("");
    setImportMode(null);
    setImporting(false);
    toast.success(
      `${names.length} ${importMode === "pieces" ? (names.length === 1 ? "peça criada" : "peças criadas") : names.length === 1 ? "exercício criado" : "exercícios criados"}!`,
    );
  }

  useEffect(() => {
    if (profile) fetchAll();
  }, [profile]);

  async function fetchAll() {
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("profile_id", profile!.id)
      .single();

    if (studentError || !student) {
      console.error("[RepertoirePage] student fetch failed:", studentError);
      setFetchError(
        "Não foi possível carregar seu repertório. Tente recarregar a página.",
      );
      setLoading(false);
      return;
    }
    setStudentId(student.id);

    const [piecesRes, exercisesRes, completionsRes] = await Promise.all([
      supabase
        .from("pieces")
        .select(
          "id, title, composer, status, completion_pct, is_in_maintenance, checklist_items(id, title, category, position, is_optional)",
        )
        .eq("student_id", student.id)
        .order("title"),
      supabase
        .from("exercises")
        .select("id, title, category, status")
        .eq("student_id", student.id)
        .order("title"),
      supabase
        .from("checklist_completions")
        .select("checklist_item_id")
        .eq("student_id", student.id),
    ]);

    if (piecesRes.error || exercisesRes.error) {
      console.error(
        "[RepertoirePage] fetch failed:",
        piecesRes.error ?? exercisesRes.error,
      );
      setFetchError(
        "Não foi possível carregar o repertório. Tente recarregar a página.",
      );
      setLoading(false);
      return;
    }

    setPieces(
      (piecesRes.data ?? []).map((p: Piece) => ({
        ...p,
        checklist_items: (p.checklist_items ?? []).sort(
          (a: ChecklistItem, b: ChecklistItem) => a.position - b.position,
        ),
      })),
    );
    setExercises(exercisesRes.data ?? []);
    setCompletedIds(
      new Set(
        (completionsRes.data ?? []).map(
          (c: { checklist_item_id: string }) => c.checklist_item_id,
        ),
      ),
    );
    setLoading(false);
  }

  function pieceSortKey(p: Piece): number {
    if (p.status === "in_progress" || p.status === "future") return 0
    if (p.status === "completed" && p.is_in_maintenance) return 1
    if (p.status === "paused") return 2
    if (p.status === "completed" && !p.is_in_maintenance) return 3
    return 4
  }

  function exerciseSortKey(e: Exercise): number {
    if (e.status === "active") return 0
    if (e.status === "inactive") return 1
    if (e.status === "completed") return 2
    return 3
  }

  const sortedPieces = [...pieces].sort((a, b) => pieceSortKey(a) - pieceSortKey(b))
  const sortedExercises = [...exercises].sort((a, b) => exerciseSortKey(a) - exerciseSortKey(b))

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </StudentLayout>
    );
  }

  if (fetchError) {
    return (
      <StudentLayout>
        <p className="text-sm text-red-500 text-center py-12">{fetchError}</p>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Repertório</h1>
          <p className="text-sm text-gray-400 mt-0.5">Seu material de estudo</p>
        </div>
        <button
          onClick={toggleSelectionMode}
          className={`p-2 rounded-xl transition ${
            isSelectionMode
              ? "bg-[#4A90C4] text-white"
              : "text-gray-400 hover:text-[#1E3A5F] hover:bg-gray-100"
          }`}
          aria-label="Selecionar itens"
        >
          <MdSettings size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div
        id="onboarding-repertoire-tabs"
        className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5"
      >
        {[
          { key: "pieces" as TabKey, label: `Peças (${pieces.length})` },
          {
            key: "exercises" as TabKey,
            label: `Exercícios (${exercises.length})`,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === tab.key
                ? "bg-white text-[#1E3A5F] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Selection mode: counter + action bar */}
      {isSelectionMode && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-[#4A90C4] font-semibold shrink-0">
            {selectedIds.size} {selectedIds.size === 1 ? "item selecionado" : "itens selecionados"}
          </p>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              {/* "Selecione" dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu((v) => !v)}
                  disabled={bulkLoading}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-600 hover:border-[#4A90C4] hover:text-[#4A90C4] transition disabled:opacity-50 flex items-center gap-1.5 min-w-[120px] justify-between"
                >
                  <span>{selectedAction ? selectedAction.label : "Selecione"}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={`transition-transform shrink-0 ${showStatusMenu ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {showStatusMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-10 min-w-[180px]">
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Alterar status</p>
                    {activeTab === "pieces" ? (
                      <>
                        <button onClick={() => { setSelectedAction({ type: "status", value: "in_progress", label: "Em andamento" }); setShowStatusMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA]">Em andamento</button>
                        <button onClick={() => { setSelectedAction({ type: "status", value: "paused", label: "Pausada" }); setShowStatusMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA]">Pausada</button>
                        <button onClick={() => { setSelectedAction({ type: "status", value: "completed", label: "Concluída" }); setShowStatusMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA]">Concluída</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setSelectedAction({ type: "status", value: "active", label: "Em andamento" }); setShowStatusMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA]">Em andamento</button>
                        <button onClick={() => { setSelectedAction({ type: "status", value: "inactive", label: "Pausada" }); setShowStatusMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA]">Pausada</button>
                        <button onClick={() => { setSelectedAction({ type: "status", value: "completed", label: "Concluída" }); setShowStatusMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA]">Concluída</button>
                      </>
                    )}
                    <div className="border-t border-gray-100 mt-1">
                      <button onClick={() => { setSelectedAction({ type: "delete", label: "Excluir" }); setShowStatusMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-[#F5F7FA] rounded-b-xl">Excluir</button>
                    </div>
                  </div>
                )}
              </div>

              {/* "Aplicar a todos" button */}
              <button
                onClick={() => {
                  if (!selectedAction) return;
                  if (selectedAction.type === "status") handleBulkStatusChange((selectedAction as { type: "status"; value: string; label: string }).value);
                  else setConfirmBulkAction("delete");
                }}
                disabled={!selectedAction || bulkLoading}
                className="px-3 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#1E3A5F]/90 transition disabled:opacity-40"
              >
                Aplicar ação a todos
              </button>

              <button
                onClick={exitSelectionMode}
                className="px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition"
              >
                Cancelar
              </button>
            </div>
          )}
          {selectedIds.size === 0 && (
            <button
              onClick={exitSelectionMode}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 transition"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {/* Tab: Peças */}
      {activeTab === "pieces" && (
        <div className="space-y-3">
          {sortedPieces.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdMusicNote size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-600">
                Nenhuma peça cadastrada
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Adicione sua primeira peça!
              </p>
            </div>
          ) : (
            sortedPieces.map((piece) => {
              const isExpanded = expandedPieceId === piece.id;
              const grouped = piece.checklist_items.reduce<
                Record<string, ChecklistItem[]>
              >((acc, item) => {
                const cat = item.category ?? "Geral";
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(item);
                return acc;
              }, {});

              return (
                <div
                  key={piece.id}
                  id={
                    piece === pieces[0]
                      ? "onboarding-repertoire-piece"
                      : undefined
                  }
                  className={`rounded-2xl border overflow-hidden transition ${
                    isSelectionMode && selectedIds.has(piece.id)
                      ? "bg-[#EBF4FB] border-2 border-[#4A90C4]"
                      : "bg-white border-gray-100"
                  }`}
                  onClick={isSelectionMode ? () => toggleItemSelected(piece.id) : undefined}
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    {isSelectionMode && (
                      <div className="shrink-0">
                        {selectedIds.has(piece.id)
                          ? <MdCheckBox size={22} className="text-[#4A90C4]" />
                          : <MdCheckBoxOutlineBlank size={22} className="text-gray-300" />
                        }
                      </div>
                    )}
                    <button
                      onClick={isSelectionMode
                        ? (e) => { e.stopPropagation(); toggleItemSelected(piece.id); }
                        : () => navigate(`/aluno/repertorio/pecas/${piece.id}`)
                      }
                      className="relative w-10 h-10 shrink-0"
                    >
                      <svg
                        viewBox="0 0 36 36"
                        className="w-10 h-10 -rotate-90 absolute inset-0"
                      >
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="#F3F4F6"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke={
                            piece.status === "paused"
                              ? "#D1D5DB"
                              : piece.status === "completed"
                                ? "#22c55e"
                                : "#4A90C4"
                          }
                          strokeWidth="3"
                          strokeDasharray={`${(piece.completion_pct / 100) * 94.2} 94.2`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {piece.status === "paused" ? (
                          <div className="w-6 h-6 rounded-full bg-gray-100" />
                        ) : (
                          <div className="rounded-full overflow-hidden">
                            <Avatar
                              size={24}
                              name={piece.title}
                              variant="marble"
                              colors={AVATAR_COLORS}
                            />
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={isSelectionMode
                        ? (e) => { e.stopPropagation(); toggleItemSelected(piece.id); }
                        : () => navigate(`/aluno/repertorio/pecas/${piece.id}`)
                      }
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {piece.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {piece.composer ?? "—"}
                      </p>
                    </button>

                    <Switch
                      checked={
                        piece.status === "completed"
                          ? piece.is_in_maintenance
                          : piece.status === "in_progress"
                      }
                      onCheckedChange={(checked) =>
                        requestPieceToggle(piece, checked)
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelectionMode) toggleItemSelected(piece.id);
                      }}
                      className={`shrink-0 ${piece.status === "completed" ? "data-checked:bg-green-500" : "data-checked:bg-[#1E3A5F]"}`}
                    />

                    <button
                      onClick={isSelectionMode
                        ? (e) => e.stopPropagation()
                        : () => setExpandedPieceId(isExpanded ? null : piece.id)
                      }
                      className="shrink-0 text-gray-400 hover:text-gray-600 transition p-1"
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>

                  {isExpanded && !isSelectionMode && (
                    <div className="px-5 pb-4 border-t border-gray-100">
                      {piece.checklist_items.length === 0 ? (
                        <p className="text-xs text-gray-400 pt-3">
                          Nenhum item no checklist.
                        </p>
                      ) : (
                        <div className="space-y-4 pt-3">
                          {Object.entries(grouped).map(([category, items]) => (
                            <div key={category}>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                {category}
                              </p>
                              <div className="space-y-2">
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-3"
                                  >
                                    <div
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                        completedIds.has(item.id)
                                          ? "bg-[#1E3A5F] border-[#1E3A5F]"
                                          : "border-gray-300"
                                      }`}
                                    >
                                      {completedIds.has(item.id) && (
                                        <svg
                                          width="8"
                                          height="8"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="white"
                                          strokeWidth={3}
                                        >
                                          <path d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    <span
                                      className={`text-xs flex-1 ${completedIds.has(item.id) ? "line-through text-gray-300" : "text-gray-600"}`}
                                    >
                                      {item.title}
                                      {item.is_optional && (
                                        <span className="text-gray-400 ml-1">
                                          (opcional)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div className="flex flex-col items-center gap-2 pt-4 pb-2">
            <button
              onClick={() => navigate("/aluno/repertorio/pecas/nova")}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition"
            >
              <MdAdd size={18} />
              Nova peça
            </button>
            <button
              onClick={() => {
                setImportMode("pieces");
                setImportText("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition"
            >
              ou clique para importar em lote
            </button>
          </div>
        </div>
      )}

      {/* Tab: Exercícios */}
      {activeTab === "exercises" && (
        <div className="space-y-3">
          {sortedExercises.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdFitnessCenter size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-600">
                Nenhum exercício cadastrado
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Adicione seu primeiro exercício!
              </p>
            </div>
          ) : (
            sortedExercises.map((ex) => (
              <div
                key={ex.id}
                className={`rounded-2xl border px-5 py-4 flex items-center gap-4 transition ${
                  isSelectionMode && selectedIds.has(ex.id)
                    ? "bg-[#EBF4FB] border-2 border-[#4A90C4]"
                    : "bg-white border-gray-100"
                }`}
                onClick={isSelectionMode ? () => toggleItemSelected(ex.id) : undefined}
              >
                {isSelectionMode && (
                  <div className="shrink-0">
                    {selectedIds.has(ex.id)
                      ? <MdCheckBox size={22} className="text-[#4A90C4]" />
                      : <MdCheckBoxOutlineBlank size={22} className="text-gray-300" />
                    }
                  </div>
                )}
                <button
                  onClick={isSelectionMode
                    ? (e) => { e.stopPropagation(); toggleItemSelected(ex.id); }
                    : () => navigate(`/aluno/repertorio/exercicios/${ex.id}`)
                  }
                  className="shrink-0"
                >
                  {ex.status === "inactive" ? (
                    <div className="w-9 h-9 rounded-full bg-gray-100" />
                  ) : (
                    <div className="rounded-lg overflow-hidden">
                      <Avatar
                        size={36}
                        name={ex.title}
                        variant="pixel"
                        colors={AVATAR_COLORS}
                      />
                    </div>
                  )}
                </button>
                <button
                  onClick={isSelectionMode
                    ? (e) => { e.stopPropagation(); toggleItemSelected(ex.id); }
                    : () => navigate(`/aluno/repertorio/exercicios/${ex.id}`)
                  }
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {ex.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {categoryLabel[ex.category] ?? ex.category}
                  </p>
                </button>
                <Switch
                  checked={ex.status === "active"}
                  onCheckedChange={(checked) =>
                    requestExerciseToggle(ex, checked)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelectionMode) toggleItemSelected(ex.id);
                  }}
                  className="shrink-0 data-checked:bg-[#1E3A5F]"
                />
                <button
                  onClick={isSelectionMode
                    ? (e) => e.stopPropagation()
                    : () => navigate(`/aluno/repertorio/exercicios/${ex.id}`)
                  }
                  className="shrink-0 text-gray-400 hover:text-gray-600 transition p-1"
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            ))
          )}
          <div className="flex flex-col items-center gap-2 pt-4 pb-2">
            <button
              onClick={() => navigate("/aluno/repertorio/exercicios/novo")}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition"
            >
              <MdAdd size={18} />
              Novo exercício
            </button>
            <button
              onClick={() => {
                setImportMode("exercises");
                setImportText("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition"
            >
              ou clique para importar em lote
            </button>
          </div>
        </div>
      )}

      {/* Toggle warning modal */}
      {pendingToggle && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-5"
          onClick={() => setPendingToggle(null)}
        >
          <div
            className="bg-white rounded-2xl py-10 px-8 w-full max-w-sm space-y-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-[#1E3A5F]">
                Controle de estudo
              </h3>
              {pendingToggle?.context === "piece_maintenance" ? (
                <p className="text-sm text-gray-500 leading-relaxed">
                  Ao <strong>desligar</strong> uma peça concluída, ela sai da
                  fila de manutenção e não entra mais no planejamento.
                  <br />
                  <br />
                  Ao <strong>ligar</strong>, ela volta para a revisão regular.
                </p>
              ) : pendingToggle?.context === "exercise" ? (
                <p className="text-sm text-gray-500 leading-relaxed">
                  Ao <strong>desligar</strong> um exercício, ele é desativado e
                  removido do planejamento automático.
                  <br />
                  <br />
                  Ao <strong>ligar</strong>, ele volta como ativo e entra no
                  plano.
                </p>
              ) : (
                <p className="text-sm text-gray-500 leading-relaxed">
                  Ao <strong>desligar</strong> uma peça, ela é pausada e
                  removida do planejamento automático.
                  <br />
                  <br />
                  Ao <strong>ligar</strong>, ela volta como ativa e entra no
                  plano.
                </p>
              )}
            </div>
            <label className="flex items-center justify-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1E3A5F] cursor-pointer"
              />
              <span className="text-xs text-gray-500">
                Não mostrar novamente
              </span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingToggle(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmToggle}
                className="flex-1 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition"
              >
                Entendi, continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      {confirmBulkAction === "delete" && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-5"
          onClick={() => setConfirmBulkAction(null)}
        >
          <div
            className="bg-white rounded-2xl py-10 px-8 w-full max-w-sm space-y-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-[#1E3A5F]">Excluir itens</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {selectedIds.size === 1
                  ? "1 item será excluído permanentemente."
                  : `${selectedIds.size} itens serão excluídos permanentemente.`}{" "}
                Essa ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmBulkAction(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
              >
                {bulkLoading ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {importMode && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-5"
          onClick={() => setImportMode(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-[60%] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-bold text-[#1E3A5F]">
                Importar {importMode === "pieces" ? "peças" : "exercícios"} em
                lote
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed mt-0.5">
                Digite os nomes separados por vírgula ou um por linha.
              </p>
            </div>
            <textarea
              autoFocus
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                importMode === "pieces"
                  ? "Sonatina Op.36 nº1\nFur Elise\nNocturno Op.9 nº2"
                  : "Escala de Dó maior\nArpejo de Sol\nHanon nº1"
              }
              rows={6}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition resize-none"
            />
            <button
              onClick={handleImport}
              disabled={importing || !importText.trim()}
              className="w-full py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition disabled:opacity-50"
            >
              {importing
                ? "Criando..."
                : (() => {
                    const n = parseNames(importText).length;
                    return n > 0
                      ? `Criar ${n} ${importMode === "pieces" ? (n === 1 ? "peça" : "peças") : n === 1 ? "exercício" : "exercícios"}`
                      : "Criar";
                  })()}
            </button>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
