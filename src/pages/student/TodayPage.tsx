import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  autoGeneratePlan,
  redistributePendingItems,
  PLAN_GENERATING_EVENT,
  PLAN_DONE_EVENT,
  lastPlanGeneratedAt,
} from "@/lib/autoplan";
import {
  MdChevronLeft,
  MdChevronRight,
  MdPlayArrow,
  MdDeleteOutline,
  MdSelfImprovement,
  MdRoute,
  MdFlashOn,
  MdBuild,
  MdAccessTime,
  MdGpsFixed,
  MdArrowForward,
  MdForward,
  MdMoreVert,
  MdTouchApp,
  MdCheckCircle,
  MdSwapHoriz,
  MdCallSplit,
  MdTimer,
  MdScale,
} from "react-icons/md";
import { ContinuityCard } from "@/components/student/ContinuityCard";
import { FocusModal } from "@/components/student/FocusModal";
import { MoveTaskModal } from "@/components/student/MoveTaskModal";
import { EditDurationModal } from "@/components/student/EditDurationModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import { StudentLayout } from "@/components/layout/StudentLayout";
import {
  grantXp,
  EXERCISE_ATTRIBUTE_MAP,
  ACHIEVEMENT_LABEL,
} from "@/lib/xpHelpers";
import type { XpAttribute } from "@/lib/xpHelpers";
import {
  fireBasic,
  fireSideCannons,
  fireStars,
  hasRankUp,
} from "@/lib/confettiEffects";
import type { PlanItem } from "@/types/plan";
import {
  getMonday,
  formatWeekStart,
  getDayExtendedLabel,
  getTodayDayOfWeek,
} from "@/lib/weekUtils";

type ActivePiece = { id: string; title: string; composer: string | null };
type ActiveExercise = { id: string; title: string; category: string };
type SwapTarget =
  | { kind: "piece"; piece: ActivePiece }
  | { kind: "exercise"; exercise: ActiveExercise };

function SwapPieceModal({
  itemTitle,
  pieces,
  exercises,
  onSelect,
  onClose,
}: {
  itemTitle: string;
  pieces: ActivePiece[];
  exercises: ActiveExercise[];
  onSelect: (target: SwapTarget) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"pieces" | "exercises">("pieces");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-8 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col max-h-[70vh]">
        <div className="px-5 pt-5 pb-3 shrink-0">
          <p className="text-base font-bold text-gray-800 mb-1">
            Trocar tarefa
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Substituindo{" "}
            <span className="font-medium text-gray-600">{itemTitle}</span>
          </p>
          <div className="flex gap-1 bg-[#F5F7FA] rounded-xl p-1">
            <button
              onClick={() => setTab("pieces")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${tab === "pieces" ? "bg-white text-[#1E3A5F] shadow-sm" : "text-gray-400"}`}
            >
              Peças
            </button>
            <button
              onClick={() => setTab("exercises")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${tab === "exercises" ? "bg-white text-[#1E3A5F] shadow-sm" : "text-gray-400"}`}
            >
              Exercícios
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {tab === "pieces" ? (
            pieces.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">
                Nenhuma peça ativa.
              </p>
            ) : (
              pieces.map((piece) => (
                <button
                  key={piece.id}
                  onClick={() => onSelect({ kind: "piece", piece })}
                  className="flex flex-col w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F5F7FA] transition"
                >
                  <span className="text-sm font-medium text-gray-800">
                    {piece.title}
                  </span>
                  {piece.composer && (
                    <span className="text-xs text-gray-400">
                      {piece.composer}
                    </span>
                  )}
                </button>
              ))
            )
          ) : exercises.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">
              Nenhum exercício ativo.
            </p>
          ) : (
            exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelect({ kind: "exercise", exercise: ex })}
                className="flex flex-col w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F5F7FA] transition"
              >
                <span className="text-sm font-medium text-gray-800">
                  {ex.title}
                </span>
                <span className="text-xs text-gray-400 capitalize">
                  {ex.category}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="px-5 pb-5 pt-2 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-[#F5F7FA] transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function itemDisplay(item: PlanItem): { title: string; subtitle: string } {
  const progLabel =
    item.programa?.type === "regular" ? "" : (item.programa?.title ?? "");
  if (item.is_maintenance) {
    return { title: item.piece?.title ?? "—", subtitle: progLabel };
  }
  if (item.exercise_id && item.exercise) {
    return { title: item.exercise.title, subtitle: progLabel };
  }
  if (item.piece_id && item.piece) {
    return { title: item.piece.title, subtitle: progLabel };
  }
  return { title: "—", subtitle: "" };
}

const ATTRIBUTE_LABEL: Partial<Record<XpAttribute, string>> = {
  tecnica: "Técnica",
  leitura: "Leitura",
  ritmo: "Ritmo",
  musicalidade: "Musicalidade",
  performance: "Performance",
  percepcao: "Percepção",
  improvisacao: "Improvisação",
  teoria: "Teoria",
  historia: "História",
};

// Redistribui duration_minutes dos itens não concluídos para caber em newTotalMinutes.
// Itens concluídos nunca são alterados.

export default function TodayPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Rastreia quando foi o último fetch para detectar planos gerados enquanto fora desta página
  const lastFetchAt = useRef(0);

  const [items, setItems] = useState<PlanItem[]>([]);
  const [studiedSecs, setStudiedSecs] = useState<Record<string, number>>({});
  const [freeSessions, setFreeSessions] = useState<
    { id: string; minutes: number; label: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(
    profile?.studentId ?? null,
  );
  const POMODORO_CONFIG_KEY = "estudamus_pomodoro_config";
  function loadCachedConfig(): {
    work: number;
    break: number;
    cycles: number;
  } | null {
    try {
      const raw = localStorage.getItem(POMODORO_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  const [pomodoroConfig, setPomodoroConfig] = useState<{
    work: number;
    break: number;
    cycles: number;
  } | null>(loadCachedConfig);
  const [hasTeacher, setHasTeacher] = useState<boolean | null>(null);
  const [hasAnyPlan, setHasAnyPlan] = useState<boolean | null>(null);
  const [viewDay, setViewDay] = useState(getTodayDayOfWeek());
  const [pendingItem, setPendingItem] = useState<PlanItem | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const SKIP_KEY = "estudamus_skip_pomodoro_confirm";
  const [manualTooltip, setManualTooltip] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [maintenanceTooltip, setMaintenanceTooltip] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [movedTooltip, setMovedTooltip] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PlanItem | null>(
    null,
  );
  const [essentialMode, setEssentialMode] = useState(false);
  const [showContinuityModal, setShowContinuityModal] = useState(false);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [focusPrePieceId, setFocusPrePieceId] = useState<string | null>(null);
  const [focusPreExerciseId, setFocusPreExerciseId] = useState<string | null>(
    null,
  );
  const [moveTaskItem, setMoveTaskItem] = useState<PlanItem | null>(null);
  const [swapItem, setSwapItem] = useState<PlanItem | null>(null);
  const [activePieces, setActivePieces] = useState<ActivePiece[]>([]);
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [editDurationItem, setEditDurationItem] = useState<PlanItem | null>(
    null,
  );
  const [focusDayPieceId, setFocusDayPieceId] = useState<string | null>(null);
  const [focusDayExerciseId, setFocusDayExerciseId] = useState<string | null>(
    null,
  );
  const [focusWeekPieceId, setFocusWeekPieceId] = useState<string | null>(null);
  const [focusWeekExerciseId, setFocusWeekExerciseId] = useState<string | null>(
    null,
  );

  const [pendingAction, setPendingAction] = useState<{
    type: "skip" | "focus" | "move";
    item: PlanItem;
    dontShowAgain: boolean;
  } | null>(null);
  const [showChangeTime, setShowChangeTime] = useState(false);
  const [changeTimeMinutes, setChangeTimeMinutes] = useState(60);
  const [showRebalanceConfirm, setShowRebalanceConfirm] = useState(false);
  const [ungroupConfirmItem, setUngroupConfirmItem] = useState<PlanItem | null>(null);

  const monday = useMemo(() => getMonday(new Date()), []);
  const weekStart = useMemo(() => formatWeekStart(monday), [monday]);
  const viewDate = new Date(monday);
  viewDate.setDate(viewDate.getDate() + (viewDay === 0 ? 6 : viewDay - 1));
  const dayNum = String(viewDate.getDate()).padStart(2, "0");
  const monthLabel = viewDate
    .toLocaleDateString("pt-BR", { month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());

  useEffect(() => {
    if (profile) fetchDayPlan();
  }, [profile, viewDay]);

  // Re-fetcha ao voltar para a aba ou navegar de volta — também cobre plano gerado em outra tela
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && profile && studentId) fetchItems(studentId);
    };
    document.addEventListener("visibilitychange", onVisible);

    // Re-fetcha imediatamente se um plano foi gerado enquanto esta página não estava ativa
    if (studentId && lastPlanGeneratedAt > lastFetchAt.current) {
      fetchItems(studentId);
    }

    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [profile, studentId, viewDay]);

  // Escuta eventos de regeneração do plano disparados por qualquer tela
  useEffect(() => {
    const onGenerating = () => setPlanGenerating(true);
    const onDone = () => {
      setPlanGenerating(false);
      if (studentId) setTimeout(() => fetchItems(studentId), 300);
    };
    window.addEventListener(PLAN_GENERATING_EVENT, onGenerating);
    window.addEventListener(PLAN_DONE_EVENT, onDone);
    return () => {
      window.removeEventListener(PLAN_GENERATING_EVENT, onGenerating);
      window.removeEventListener(PLAN_DONE_EVENT, onDone);
    };
  }, [studentId]);

  // Atualiza config de pomodoro quando salva em PomodoroPage
  useEffect(() => {
    const onConfigChanged = (e: Event) => {
      const {
        work,
        break: brk,
        cycles,
      } = (e as CustomEvent<{ work: number; break: number; cycles: number }>)
        .detail;
      const cfg = { work, break: brk, cycles };
      localStorage.setItem(POMODORO_CONFIG_KEY, JSON.stringify(cfg));
      setPomodoroConfig(cfg);
    };
    window.addEventListener("POMODORO_CONFIG_CHANGED", onConfigChanged);
    return () =>
      window.removeEventListener("POMODORO_CONFIG_CHANGED", onConfigChanged);
  }, []);

  // Verifica pendências de dias passados (roda uma vez quando studentId fica disponível)
  useEffect(() => {
    if (!studentId) return;
    checkPendingPastItems(studentId);
  }, [studentId]);

  async function fetchDayPlan() {
    setLoading(true);

    const sid = studentId ?? profile?.studentId ?? null;
    if (!sid) {
      setFetchError(
        "Perfil de aluno não encontrado. Tente recarregar a página.",
      );
      setLoading(false);
      return;
    }

    if (!studentId) {
      setStudentId(sid);
      // Busca teacher_id e config de pomodoro
      const { data: studentRaw } = await supabase
        .from("students")
        .select(
          "teacher_id, pomodoro_work, pomodoro_break, pomodoro_cycles, " +
            "focus_day_piece_id, focus_day_exercise_id, focus_day_date, " +
            "focus_week_piece_id, focus_week_exercise_id, focus_week_start",
        )
        .eq("id", sid)
        .single();
      const student = studentRaw as {
        teacher_id: string | null;
        pomodoro_work: number | null;
        pomodoro_break: number | null;
        pomodoro_cycles: number | null;
        focus_day_piece_id: string | null;
        focus_day_exercise_id: string | null;
        focus_day_date: string | null;
        focus_week_piece_id: string | null;
        focus_week_exercise_id: string | null;
        focus_week_start: string | null;
      } | null;
      setHasTeacher(!!student?.teacher_id);
      if (
        student?.pomodoro_work &&
        student?.pomodoro_break &&
        student?.pomodoro_cycles
      ) {
        const cfg = {
          work: student.pomodoro_work,
          break: student.pomodoro_break,
          cycles: student.pomodoro_cycles,
        };
        localStorage.setItem(POMODORO_CONFIG_KEY, JSON.stringify(cfg));
        setPomodoroConfig(cfg);
      }
      // Carrega foco do dia (válido somente se for hoje)
      const todayStr = new Date().toISOString().slice(0, 10);
      if (student?.focus_day_date === todayStr) {
        setFocusDayPieceId(student.focus_day_piece_id ?? null);
        setFocusDayExerciseId(student.focus_day_exercise_id ?? null);
      }
      // Carrega foco da semana (válido somente se for esta semana)
      if (student?.focus_week_start === weekStart) {
        setFocusWeekPieceId(student.focus_week_piece_id ?? null);
        setFocusWeekExerciseId(student.focus_week_exercise_id ?? null);
      }
    }

    await fetchItems(sid);
  }

  async function checkPendingPastItems(sid: string) {
    const { data: plan } = await supabase
      .from("weekly_plans")
      .select("id")
      .eq("student_id", sid)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (!plan) return;

    const todayDow = getTodayDayOfWeek();
    // Dias que já passaram nesta semana (ciclo: Mon=1…Sat=6, Sun=0)
    const pastDays =
      todayDow === 0
        ? [1, 2, 3, 4, 5, 6]
        : Array.from({ length: todayDow - 1 }, (_, i) => i + 1);

    if (pastDays.length === 0) return;

    const { data: pendingRows } = await supabase
      .from("plan_items")
      .select("id")
      .eq("plan_id", plan.id)
      .eq("is_done", false)
      .in("day_of_week", pastDays)
      .limit(1);

    if (!pendingRows || pendingRows.length === 0) return;

    const EXPLAINED_KEY = "estudamus_continuity_explained";
    const isFirstTime = !localStorage.getItem(EXPLAINED_KEY);

    const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
    const todayDow2 = getTodayDayOfWeek();
    const remaining = WEEK_ORDER.slice(WEEK_ORDER.indexOf(todayDow2));
    const moved = await redistributePendingItems(plan.id, remaining);

    if (moved) await fetchItems(sid);

    if (isFirstTime) {
      localStorage.setItem(EXPLAINED_KEY, "1");
      setShowContinuityModal(true);
    }
  }

  async function handleChangeTimeConfirm() {
    const undone = items.filter((i) => i.day_of_week === viewDay && !i.is_done);
    if (undone.length === 0) { setShowChangeTime(false); return; }
    const perTask = Math.max(5, Math.floor(changeTimeMinutes / undone.length));
    const updated = items.map((i) =>
      undone.find((u) => u.id === i.id) ? { ...i, duration_minutes: perTask } : i,
    );
    setItems(updated);
    await Promise.all(
      undone.map((i) =>
        supabase.from("plan_items").update({ duration_minutes: perTask }).eq("id", i.id),
      ),
    );
    setShowChangeTime(false);
    toast.success("Tempo do dia atualizado");
  }

  async function handleEqualizeTime() {
    const undone = items.filter((i) => i.day_of_week === viewDay && !i.is_done);
    if (undone.length === 0) return;
    const doneMin = items
      .filter((i) => i.day_of_week === viewDay && i.is_done)
      .reduce((s, i) => s + (i.duration_minutes ?? 0), 0);
    const available = Math.max(0, totalMinutes - doneMin);
    const perTask = Math.max(5, Math.floor(available / undone.length));
    const updated = items.map((i) =>
      undone.find((u) => u.id === i.id)
        ? { ...i, duration_minutes: perTask }
        : i,
    );
    setItems(updated);
    await Promise.all(
      undone.map((i) =>
        supabase
          .from("plan_items")
          .update({ duration_minutes: perTask })
          .eq("id", i.id),
      ),
    );
    toast.success("Tempo distribuído igualmente");
  }

  const ACTION_SKIP_KEY = "estudamus_action_skip_confirmed";
  const ACTION_FOCUS_KEY = "estudamus_action_focus_confirmed";
  const ACTION_MOVE_KEY = "estudamus_action_move_confirmed";

  function handleActionClick(type: "skip" | "focus" | "move", item: PlanItem) {
    const key =
      type === "skip"
        ? ACTION_SKIP_KEY
        : type === "focus"
          ? ACTION_FOCUS_KEY
          : ACTION_MOVE_KEY;

    if (localStorage.getItem(key)) {
      executeAction(type, item);
    } else {
      setPendingAction({ type, item, dontShowAgain: false });
    }
  }

  function executeAction(type: "skip" | "focus" | "move", item: PlanItem) {
    if (type === "skip") {
      handleSkipToday(item);
    } else if (type === "focus") {
      setFocusPrePieceId(item.piece_id ?? null);
      setFocusPreExerciseId(item.exercise_id ?? null);
      setShowFocusModal(true);
    } else {
      setMoveTaskItem(item);
    }
  }

  async function handleSkipToday(item: PlanItem) {
    const freedMinutes = item.duration_minutes ?? 0;
    await supabase
      .from("plan_items")
      .update({ duration_minutes: 0 })
      .eq("id", item.id);

    const others = items.filter(
      (i) =>
        i.id !== item.id &&
        i.day_of_week === viewDay &&
        !i.is_done &&
        (i.duration_minutes ?? 0) > 0,
    );

    if (others.length > 0 && freedMinutes > 0) {
      const bonus = Math.round(freedMinutes / others.length);
      await Promise.all(
        others.map((o) =>
          supabase
            .from("plan_items")
            .update({ duration_minutes: (o.duration_minutes ?? 0) + bonus })
            .eq("id", o.id),
        ),
      );
      setItems((prev) =>
        prev
          .filter((i) => i.id !== item.id)
          .map((i) =>
            others.find((o) => o.id === i.id)
              ? { ...i, duration_minutes: (i.duration_minutes ?? 0) + bonus }
              : i,
          ),
      );
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }

    toast.success("Pulada! Tempo redistribuído.");
  }

  function handleDeleteItem(item: PlanItem) {
    setDeleteConfirmItem(item);
  }

  async function executeDelete(item: PlanItem, redistribute: boolean) {
    await supabase.from("plan_items").delete().eq("id", item.id);

    if (redistribute) {
      const freedMinutes = item.duration_minutes ?? 0;
      const others = items.filter(
        (i) =>
          i.id !== item.id &&
          i.day_of_week === viewDay &&
          !i.is_done &&
          (i.duration_minutes ?? 0) > 0,
      );
      if (others.length > 0 && freedMinutes > 0) {
        const bonus = Math.round(freedMinutes / others.length);
        await Promise.all(
          others.map((o) =>
            supabase
              .from("plan_items")
              .update({ duration_minutes: (o.duration_minutes ?? 0) + bonus })
              .eq("id", o.id),
          ),
        );
        setItems((prev) =>
          prev
            .filter((i) => i.id !== item.id)
            .map((i) => {
              const o = others.find((o) => o.id === i.id);
              return o
                ? { ...i, duration_minutes: (i.duration_minutes ?? 0) + bonus }
                : i;
            }),
        );
        toast.success("Tarefa removida e tempo redistribuído.");
      } else {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        toast.success("Tarefa removida.");
      }
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Tarefa removida.");
    }

    setDeleteConfirmItem(null);
  }

  async function handleEditDurationThis(item: PlanItem, minutes: number) {
    await supabase
      .from("plan_items")
      .update({ duration_minutes: minutes })
      .eq("id", item.id);
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, duration_minutes: minutes } : i,
      ),
    );
    setEditDurationItem(null);
    toast.success("Tempo atualizado.");
  }

  async function handleEditDurationAll(item: PlanItem, minutes: number) {
    const diff = minutes - (item.duration_minutes ?? 0);
    await supabase
      .from("plan_items")
      .update({ duration_minutes: minutes })
      .eq("id", item.id);
    const others = items.filter(
      (i) =>
        i.id !== item.id &&
        i.day_of_week === viewDay &&
        !i.is_done &&
        (i.duration_minutes ?? 0) > 0,
    );
    const othersTotal = others.reduce(
      (s, i) => s + (i.duration_minutes ?? 0),
      0,
    );
    if (others.length > 0 && othersTotal > 0) {
      await Promise.all(
        others.map((o) => {
          const reduction = Math.round(
            (diff * (o.duration_minutes ?? 0)) / othersTotal,
          );
          const newDur = Math.max(5, (o.duration_minutes ?? 0) - reduction);
          return supabase
            .from("plan_items")
            .update({ duration_minutes: newDur })
            .eq("id", o.id);
        }),
      );
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id) return { ...i, duration_minutes: minutes };
          const o = others.find((o) => o.id === i.id);
          if (!o) return i;
          const reduction = Math.round(
            (diff * (o.duration_minutes ?? 0)) / othersTotal,
          );
          return {
            ...i,
            duration_minutes: Math.max(
              5,
              (i.duration_minutes ?? 0) - reduction,
            ),
          };
        }),
      );
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, duration_minutes: minutes } : i,
        ),
      );
    }
    setEditDurationItem(null);
    toast.success("Tempo atualizado e redistribuído.");
  }

  async function handleMoveTask(item: PlanItem, newDow: number) {
    await supabase
      .from("plan_items")
      .update({ day_of_week: newDow, moved_from_dow: item.day_of_week })
      .eq("id", item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setMoveTaskItem(null);
    toast.success(`Tarefa movida para ${getDayExtendedLabel(newDow)}.`);
  }

  async function handleSwap(item: PlanItem, target: SwapTarget) {
    if (target.kind === "piece") {
      const { piece } = target;
      await supabase
        .from("plan_items")
        .update({ piece_id: piece.id, exercise_id: null })
        .eq("id", item.id);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                piece_id: piece.id,
                exercise_id: null,
                piece: { title: piece.title, composer: piece.composer },
                exercise: null,
              }
            : i,
        ),
      );
      toast.success(`Tarefa trocada para "${piece.title}".`);
    } else {
      const { exercise } = target;
      await supabase
        .from("plan_items")
        .update({ exercise_id: exercise.id, piece_id: null })
        .eq("id", item.id);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                exercise_id: exercise.id,
                piece_id: null,
                exercise: {
                  title: exercise.title,
                  category: exercise.category,
                },
                piece: null,
              }
            : i,
        ),
      );
      toast.success(`Tarefa trocada para "${exercise.title}".`);
    }
    setSwapItem(null);
  }

  async function handleUngroup(item: PlanItem) {
    const total = item.duration_minutes ?? 0;
    const blockMin = pomodoroConfig?.work ?? 25;
    if (total <= blockMin) {
      toast("Tarefa já cabe em uma sessão.");
      return;
    }

    const blocks: number[] = [];
    let remaining = total;
    while (remaining > 0) {
      blocks.push(Math.min(blockMin, remaining));
      remaining -= blockMin;
    }

    // posição base: após o item atual
    const basePosition = item.position;
    const after = items.filter(
      (i) => i.day_of_week === viewDay && i.position > basePosition,
    );

    // shift items after to make room
    if (after.length > 0) {
      await Promise.all(
        after.map((i) =>
          supabase
            .from("plan_items")
            .update({ position: i.position + blocks.length - 1 })
            .eq("id", i.id),
        ),
      );
    }

    // delete original
    await supabase.from("plan_items").delete().eq("id", item.id);

    // insert new blocks
    const newRows = blocks.map((mins, idx) => ({
      plan_id: item.plan_id,
      day_of_week: item.day_of_week,
      piece_id: item.piece_id,
      exercise_id: item.exercise_id,
      program_id: item.program_id,
      duration_minutes: mins,
      position: basePosition + idx,
      is_done: false,
      is_maintenance: item.is_maintenance,
    }));

    const { data: inserted } = await supabase.from("plan_items").insert(newRows)
      .select(`id, plan_id, day_of_week, piece_id, exercise_id, program_id,
        duration_minutes, position, is_done, done_at, is_maintenance, completed_manually, moved_from_dow, group_id,
        piece:pieces(title, composer), exercise:exercises(title, category), programa:programas(title, type)`);

    setItems((prev) => {
      const without = prev.filter((i) => i.id !== item.id);
      const shifted = without.map((i) =>
        i.day_of_week === viewDay && i.position > basePosition
          ? { ...i, position: i.position + blocks.length - 1 }
          : i,
      );
      return [...shifted, ...((inserted ?? []) as unknown as PlanItem[])].sort(
        (a, b) => a.position - b.position,
      );
    });

    toast.success(`Dividido em ${blocks.length} sessões de ${blockMin} min.`);
  }

  async function handleApplyFocus(
    scope: "day" | "week",
    pieceId: string | null,
    exerciseId: string | null,
  ) {
    setShowFocusModal(false);
    setFocusPrePieceId(null);
    setFocusPreExerciseId(null);

    if (scope === "day") {
      const focusedItems = items.filter(
        (i) =>
          i.day_of_week === viewDay &&
          !i.is_done &&
          ((pieceId && i.piece_id === pieceId) ||
            (exerciseId && i.exercise_id === exerciseId)),
      );
      if (!focusedItems.length) return;

      const dayUndone = items.filter(
        (i) => i.day_of_week === viewDay && !i.is_done,
      );
      const total = dayUndone.reduce(
        (s, i) => s + (i.duration_minutes ?? 0),
        0,
      );
      const bonus = Math.round(total * 0.3);
      const others = dayUndone.filter(
        (i) => !focusedItems.find((f) => f.id === i.id),
      );
      const othersTotal = others.reduce(
        (s, i) => s + (i.duration_minutes ?? 0),
        0,
      );

      const extra = Math.round(bonus / Math.max(1, focusedItems.length));
      await Promise.all(
        focusedItems.map((i) =>
          supabase
            .from("plan_items")
            .update({ duration_minutes: (i.duration_minutes ?? 0) + extra })
            .eq("id", i.id),
        ),
      );
      await Promise.all(
        others.map((i) => {
          const reduction =
            othersTotal > 0
              ? Math.round((bonus * (i.duration_minutes ?? 0)) / othersTotal)
              : 0;
          const newDur = Math.max(5, (i.duration_minutes ?? 0) - reduction);
          return supabase
            .from("plan_items")
            .update({ duration_minutes: newDur })
            .eq("id", i.id);
        }),
      );

      // Persiste foco do dia no banco
      if (studentId) {
        const todayStr = new Date().toISOString().slice(0, 10);
        await supabase
          .from("students")
          .update({
            focus_day_piece_id: pieceId,
            focus_day_exercise_id: exerciseId,
            focus_day_date: todayStr,
          } as Record<string, unknown>)
          .eq("id", studentId);
        setFocusDayPieceId(pieceId);
        setFocusDayExerciseId(exerciseId);
        await fetchItems(studentId);
      }
      toast.success("Foco aplicado para hoje!");
    } else {
      const planId = items[0]?.plan_id;
      if (!planId) return;

      const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
      const todayIdx = WEEK_ORDER.indexOf(viewDay);
      const remainingDows = WEEK_ORDER.slice(todayIdx + 1);
      if (!remainingDows.length) return;

      const { data: weekItems } = await supabase
        .from("plan_items")
        .select(
          "id, plan_id, day_of_week, piece_id, exercise_id, duration_minutes, is_done",
        )
        .eq("plan_id", planId)
        .in("day_of_week", remainingDows)
        .eq("is_done", false);

      const weekData = (weekItems ?? []) as Array<{
        id: string;
        day_of_week: number;
        piece_id: string | null;
        exercise_id: string | null;
        duration_minutes: number | null;
        is_done: boolean;
      }>;

      for (const dow of remainingDows) {
        const dayItems = weekData.filter((i) => i.day_of_week === dow);
        const focused = dayItems.filter(
          (i) =>
            (pieceId && i.piece_id === pieceId) ||
            (exerciseId && i.exercise_id === exerciseId),
        );
        if (!focused.length) continue;

        const total = dayItems.reduce(
          (s, i) => s + (i.duration_minutes ?? 0),
          0,
        );
        const bonus = Math.round(total * 0.25);
        const others = dayItems.filter(
          (i) => !focused.find((f) => f.id === i.id),
        );
        const othersTotal = others.reduce(
          (s, i) => s + (i.duration_minutes ?? 0),
          0,
        );
        const extra = Math.round(bonus / Math.max(1, focused.length));

        await Promise.all(
          focused.map((i) =>
            supabase
              .from("plan_items")
              .update({ duration_minutes: (i.duration_minutes ?? 0) + extra })
              .eq("id", i.id),
          ),
        );
        await Promise.all(
          others.map((i) => {
            const reduction =
              othersTotal > 0
                ? Math.round((bonus * (i.duration_minutes ?? 0)) / othersTotal)
                : 0;
            const newDur = Math.max(5, (i.duration_minutes ?? 0) - reduction);
            return supabase
              .from("plan_items")
              .update({ duration_minutes: newDur })
              .eq("id", i.id);
          }),
        );
      }

      // Persiste foco da semana no banco
      if (studentId) {
        await supabase
          .from("students")
          .update({
            focus_week_piece_id: pieceId,
            focus_week_exercise_id: exerciseId,
            focus_week_start: weekStart,
          } as Record<string, unknown>)
          .eq("id", studentId);
        setFocusWeekPieceId(pieceId);
        setFocusWeekExerciseId(exerciseId);
      }
      toast.success("Foco aplicado para a semana!");
    }
  }

  async function fetchItems(sid: string) {
    const { data: plan, error: planError } = await supabase
      .from("weekly_plans")
      .select("id")
      .eq("student_id", sid)
      .eq("week_start", weekStart)
      .single();

    if (planError && planError.code !== "PGRST116") {
      console.error("[TodayPage] plan fetch failed:", planError);
      setFetchError("Não foi possível carregar o planejamento.");
      setLoading(false);
      return;
    }

    if (!plan) {
      // Tenta gerar automaticamente o plano da semana
      const result = await autoGeneratePlan(sid);
      if (result.ok) {
        // Re-fetch agora que o plano existe
        await fetchItems(sid);
        return;
      }
      // Sem disponibilidade ou sem programas — mostra empty state normal
      const { count } = await supabase
        .from("weekly_plans")
        .select("id", { count: "exact", head: true })
        .eq("student_id", sid);
      setHasAnyPlan((count ?? 0) > 0);
      setItems([]);
      setLoading(false);
      return;
    }
    setHasAnyPlan(true);

    const { data: planItems, error: itemsError } = await supabase
      .from("plan_items")
      .select(
        `
        id, plan_id, day_of_week, piece_id, exercise_id, program_id,
        duration_minutes, position, is_done, done_at, is_maintenance, completed_manually, moved_from_dow, group_id,
        piece:pieces(title, composer),
        exercise:exercises(title, category),
        programa:programas(title, type)
      `,
      )
      .eq("plan_id", plan.id)
      .eq("day_of_week", viewDay)
      .order("position");

    if (itemsError) {
      console.error("[TodayPage] items fetch failed:", itemsError);
      setFetchError("Não foi possível carregar as tarefas do dia.");
      setLoading(false);
      return;
    }

    const resolvedItems = (planItems ?? []) as unknown as PlanItem[];
    setItems(resolvedItems);
    setEssentialMode(
      resolvedItems.some((i) => !i.is_done && i.duration_minutes === 0),
    );

    // Buscar segundos estudados por plan_item
    const planItemIds = resolvedItems.map((i) => i.id);
    if (planItemIds.length > 0) {
      const { data: sessionRows } = await supabase
        .from("session_items")
        .select("plan_item_id, duration_seconds")
        .in("plan_item_id", planItemIds);

      const secsMap: Record<string, number> = {};
      for (const row of (sessionRows ?? []) as any[]) {
        secsMap[row.plan_item_id] =
          (secsMap[row.plan_item_id] ?? 0) + (row.duration_seconds ?? 0);
      }
      setStudiedSecs(secsMap);

      // Auto-concluir itens que atingiram a minutagem
      const toComplete = resolvedItems.filter(
        (item) =>
          !item.is_done &&
          item.duration_minutes &&
          (secsMap[item.id] ?? 0) >= item.duration_minutes * 60,
      );
      if (toComplete.length > 0) {
        await Promise.all(
          toComplete.map((item) =>
            supabase
              .from("plan_items")
              .update({
                is_done: true,
                done_at: new Date().toISOString(),
                completed_manually: false,
              })
              .eq("id", item.id),
          ),
        );
        setItems((prev) =>
          prev.map((i) =>
            toComplete.find((c) => c.id === i.id) ? { ...i, is_done: true } : i,
          ),
        );
      }
    }

    // Buscar sessões livres do dia (sem plan_item vinculado)
    const dayDate = new Date(monday);
    dayDate.setDate(dayDate.getDate() + (viewDay === 0 ? 6 : viewDay - 1));
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: sessRows } = await supabase
      .from("study_sessions")
      .select(
        "id, cycle_name, duration_seconds, session_items(plan_item_id, custom_label)",
      )
      .eq("student_id", sid)
      .gte("started_at", dayStart.toISOString())
      .lte("started_at", dayEnd.toISOString());

    const free: { id: string; minutes: number; label: string }[] = [];
    for (const sess of (sessRows ?? []) as any[]) {
      const hasLinkedItem = (sess.session_items ?? []).some(
        (si: any) => si.plan_item_id,
      );
      if (!hasLinkedItem && sess.duration_seconds > 0) {
        const mins = Math.round(sess.duration_seconds / 60);
        const customLabel = (sess.session_items ?? []).find(
          (si: any) => si.custom_label,
        )?.custom_label as string | undefined;
        free.push({
          id: sess.id,
          minutes: mins,
          label: customLabel ?? sess.cycle_name ?? "Sessão livre",
        });
      }
    }
    setFreeSessions(free);

    // Peças ativas do aluno (para modal de troca)
    const { data: piecesData } = await supabase
      .from("pieces")
      .select("id, title, composer")
      .eq("student_id", sid)
      .neq("status", "future")
      .order("title");
    setActivePieces((piecesData ?? []) as ActivePiece[]);

    const { data: exercisesData } = await supabase
      .from("exercises")
      .select("id, title, category")
      .eq("student_id", sid)
      .eq("status", "active")
      .order("title");
    setActiveExercises((exercisesData ?? []) as ActiveExercise[]);

    setLoading(false);
    lastFetchAt.current = Date.now();
  }

  async function toggleDone(item: PlanItem, manually = false) {
    const newDone = !item.is_done;
    await supabase
      .from("plan_items")
      .update({
        is_done: newDone,
        done_at: newDone ? new Date().toISOString() : null,
        completed_manually: newDone ? manually : false,
      })
      .eq("id", item.id);

    const updatedItems = items.map((i) =>
      i.id === item.id
        ? {
            ...i,
            is_done: newDone,
            completed_manually: newDone ? manually : false,
          }
        : i,
    );
    setItems(updatedItems);

    if (!newDone || !studentId) return;

    // Conclusão manual não conta XP, badges nem missão do dia
    if (manually) return;

    // Determina atributo pelo tipo do item
    const category = (item as PlanItem & { exercise?: { category?: string } })
      .exercise?.category;
    const attribute: XpAttribute = category
      ? (EXERCISE_ATTRIBUTE_MAP[category] ?? "tecnica")
      : "musicalidade";

    const { newAchievements } = await grantXp(
      studentId,
      "checklist_item",
      item.id,
      attribute,
    );

    toast.success(`+15 XP · ${ATTRIBUTE_LABEL[attribute] ?? attribute}`);
    for (const key of newAchievements) {
      toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`);
    }

    if (hasRankUp(newAchievements)) fireStars();
    else fireBasic();

    // Missão do dia: todos os itens de hoje concluídos sem conclusão manual
    const totalNow = updatedItems.length;
    const doneNow = updatedItems.filter(
      (i) => i.is_done && !i.completed_manually,
    ).length;
    if (totalNow > 0 && doneNow === totalNow) {
      const { newAchievements: mAch } = await grantXp(
        studentId,
        "daily_mission",
        null,
        null,
      );
      toast.success("+20 XP · Missão do dia completa! 🎉");
      for (const key of mAch) {
        toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`);
      }
      if (hasRankUp(mAch)) fireStars();
      else fireSideCannons();
    }
  }

  async function deleteSession(sessionId: string) {
    await supabase.from("session_items").delete().eq("session_id", sessionId);
    await supabase.from("study_sessions").delete().eq("id", sessionId);
    setFreeSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  // Itens com duration_minutes=0 foram descartados pela Sessão Essencial — ocultá-los (salvo se já concluídos)
  const visibleItems = [
    ...items.filter((i) => i.duration_minutes !== 0 || i.is_done),
  ].sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
    return (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0);
  });

  const isPastDay = (() => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.indexOf(viewDay) < order.indexOf(getTodayDayOfWeek());
  })();
  const isToday = viewDay === getTodayDayOfWeek();

  // Total planejado — só itens do plano, sessões livres não inflam o alvo
  const totalMinutes = visibleItems.reduce(
    (s, i) => s + (i.duration_minutes ?? 0),
    0,
  );


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

  // Agrupar visibleItems em render units
  type RenderUnit =
    | { kind: "single"; item: PlanItem }
    | { kind: "group"; groupId: string; items: PlanItem[] };
  const _groupMap = new Map<string, PlanItem[]>();
  for (const _gi of visibleItems) {
    if (_gi.group_id) {
      if (!_groupMap.has(_gi.group_id)) _groupMap.set(_gi.group_id, []);
      _groupMap.get(_gi.group_id)!.push(_gi);
    }
  }
  const _seenGroups = new Set<string>();
  const renderUnits: RenderUnit[] = [];
  for (const _gi of visibleItems) {
    if (_gi.group_id) {
      if (!_seenGroups.has(_gi.group_id)) {
        _seenGroups.add(_gi.group_id);
        renderUnits.push({
          kind: "group",
          groupId: _gi.group_id,
          items: _groupMap.get(_gi.group_id)!,
        });
      }
    } else {
      renderUnits.push({ kind: "single", item: _gi });
    }
  }

  return (
    <StudentLayout>
      {/* Modal de continuidade — primeira vez que o plano é auto-reorganizado */}
      {showContinuityModal && (
        <ContinuityCard onDismiss={() => setShowContinuityModal(false)} />
      )}

      {/* Banner de geração de plano */}
      {planGenerating && (
        <div className="flex items-center gap-3 bg-[#1E3A5F] text-white text-sm font-medium px-4 py-3 rounded-2xl mb-4">
          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />
          Gerando plano de estudos…
        </div>
      )}

      {/* Header — < [pomodoros + data] > */}
      <div
        id="onboarding-today-nav"
        className="flex items-center mb-6 mt-4 gap-1"
      >
        <button
          onClick={() => setViewDay((d) => (d + 6) % 7)}
          className="shrink-0 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer text-gray-300 hover:text-[#1E3A5F]"
        >
          <MdChevronLeft size={36} />
        </button>

        {/* Data — centralizado */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <p className="text-7xl font-black text-[#1E3A5F] leading-none">
            {dayNum}
          </p>
          <div>
            <h1 className="text-4xl font-normal text-[#1E3A5F] leading-none">
              {getDayExtendedLabel(viewDay)}
            </h1>
            <p className="text-sm text-gray-400 mt-1 mx-0.5">{monthLabel}</p>
          </div>
        </div>

        <button
          onClick={() => setViewDay((d) => (d + 1) % 7)}
          className="shrink-0 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer text-gray-300 hover:text-[#1E3A5F]"
        >
          <MdChevronRight size={36} />
        </button>
      </div>

      {/* Lista de itens */}
      {visibleItems.length === 0 && freeSessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-10 text-center">
          {hasAnyPlan === false ? (
            <>
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdSelfImprovement size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                Jornada não iniciada
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {hasTeacher && profile?.role === "student"
                  ? "Seu professor precisa criar um plano de estudos para você."
                  : "Crie um plano antes de continuar."}
              </p>
              {!(hasTeacher && profile?.role === "student") && (
                <button
                  onClick={() => navigate("/aluno/planejamento")}
                  className="mt-4 px-5 py-2 rounded-xl bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#1E3A5F]/90 transition"
                >
                  Criar plano
                </button>
              )}
            </>
          ) : isPastDay ? (
            <>
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdRoute size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                Este dia já passou
              </p>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                Foque no que vem pela frente e continue evoluindo. Seu
                planejamento é sempre redistribuído automaticamente pra não
                deixar nenhuma tarefa pra trás!
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdSelfImprovement size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Dia livre!</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Nenhuma tarefa programada. Aproveite para um estudo livre ou
                explore o repertório.
              </p>
            </>
          )}
        </div>
      ) : (
        <div id="onboarding-today-tasks" className="space-y-3">
          {essentialMode && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2.5 flex items-center gap-2">
              <MdFlashOn size={16} className="text-orange-500" />
              <span className="text-xs text-orange-700 font-medium">
                Sessão Essencial — foco no que mais importa
              </span>
            </div>
          )}
          {renderUnits.map((unit) => {
            if (unit.kind === "group") {
              const { groupId, items: gItems } = unit;
              const allDone = gItems.every((i) => i.is_done);
              const totalDur = gItems.reduce(
                (s, i) => s + (i.duration_minutes ?? 0),
                0,
              );
              const totalStudied = gItems.reduce(
                (s, i) => s + (studiedSecs[i.id] ?? 0),
                0,
              );
              const groupPct =
                totalDur > 0
                  ? Math.min(1, totalStudied / (totalDur * 60))
                  : allDone
                    ? 1
                    : 0;

              if (allDone) {
                return (
                  <div
                    key={groupId}
                    className="group flex flex-col rounded-xl border border-[#B8D4E8] bg-[#D6E4F0] pl-3 pr-4 py-1.5 gap-1"
                  >
                    {gItems.map((gi) => {
                      const { title: gt, subtitle: gs } = itemDisplay(gi);
                      return (
                        <div key={gi.id} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                            <svg
                              width="10"
                              height="10"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="white"
                              strokeWidth={3.5}
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-xs text-gray-400 truncate flex-1 min-w-0">
                            <span className="font-medium text-gray-500">
                              {gt}
                            </span>
                            {gs ? ` · ${gs}` : ""}
                            {gi.duration_minutes
                              ? ` · ${gi.duration_minutes} min`
                              : ""}
                          </p>
                          {gi.completed_manually && (
                            <span
                              className="cursor-default select-none shrink-0 text-gray-900"
                              onMouseEnter={(e) => {
                                const r = (
                                  e.currentTarget as HTMLElement
                                ).getBoundingClientRect();
                                setManualTooltip({
                                  x: r.left + r.width / 2,
                                  y: r.top,
                                });
                              }}
                              onMouseLeave={() => setManualTooltip(null)}
                            >
                              <MdTouchApp size={18} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div
                  key={groupId}
                  className="relative rounded-2xl border border-gray-200 bg-[#F6F6F6] overflow-hidden"
                >
                  {/* Barra de progresso */}
                  <div
                    className={`absolute inset-y-0 left-0 bg-[#D6E4F0] transition-all duration-500 rounded-l-2xl ${groupPct >= 0.95 ? "rounded-r-2xl" : ""}`}
                    style={{ width: `${groupPct * 100}%` }}
                  />
                  <div className="relative z-10 flex items-stretch">
                    {/* Play — inicia todos os itens não concluídos */}
                    <button
                      onClick={() => {
                        const firstPending = gItems.find((i) => !i.is_done);
                        if (!firstPending) return;
                        const { title: ft, subtitle: fs } =
                          itemDisplay(firstPending);
                        navigate("/aluno/pomodoro", {
                          state: {
                            planItemId: firstPending.id,
                            title: fs ? `${ft} — ${fs}` : ft,
                            durationMinutes: totalDur,
                            studentId,
                          },
                        });
                      }}
                      className="shrink-0 flex items-center justify-center px-4 bg-[#D6E4F0] hover:bg-[#4A90C4] text-[#1E3A5F] hover:text-white transition"
                    >
                      <MdPlayArrow size={28} />
                    </button>
                    {/* Sub-itens */}
                    <div className="flex-1 min-w-0 py-2 pl-3 pr-2 space-y-0.5">
                      {gItems.map((gi) => {
                        const { title: gt, subtitle: gs } = itemDisplay(gi);
                        return (
                          <div
                            key={gi.id}
                            className="flex items-center gap-1.5 min-w-0"
                          >
                            {gi.is_done ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                                <svg
                                  width="7"
                                  height="7"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="white"
                                  strokeWidth={3.5}
                                >
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                            )}
                            <p
                              className={`text-xs truncate ${gi.is_done ? "text-gray-400 line-through" : "text-gray-700 font-medium"}`}
                            >
                              {gt}
                              {gs ? (
                                <span className="font-normal text-gray-400">
                                  {" "}
                                  · {gs}
                                </span>
                              ) : null}
                              <span className="font-normal text-gray-400">
                                {" "}
                                · {gi.duration_minutes} min
                              </span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {/* Total */}
                    <div className="flex items-center pr-3 shrink-0">
                      <span className="text-xs text-gray-400">
                        {totalDur} min
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // ── item solto (lógica original) ──
            const { item } = unit;
            const { title, subtitle } = itemDisplay(item);

            const itemPct = item.duration_minutes
              ? Math.min(
                  1,
                  (studiedSecs[item.id] ?? 0) / (item.duration_minutes * 60),
                )
              : item.is_done
                ? 1
                : 0;

            // Card compacto para itens concluídos
            if (item.is_done) {
              const parts = [
                subtitle,
                item.duration_minutes ? `${item.duration_minutes} min` : null,
              ].filter(Boolean);
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 rounded-xl border border-[#B8D4E8] bg-[#D6E4F0] pl-3 pr-4 py-1.5"
                >
                  <div className="w-5 h-5 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                    <svg
                      width="10"
                      height="10"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="white"
                      strokeWidth={3.5}
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-400 truncate flex-1 min-w-0">
                    <span className="font-medium text-gray-500">{title}</span>
                    {parts.length > 0 && ` · ${parts.join(" · ")}`}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition shrink-0 text-red-400 hover:text-red-600 w-7 h-7 flex items-center justify-center"
                  >
                    <MdDeleteOutline size={18} />
                  </button>
                  {item.completed_manually && (
                    <span
                      className="cursor-default select-none shrink-0 text-gray-900"
                      onMouseEnter={(e) => {
                        const r = (
                          e.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        setManualTooltip({ x: r.left + r.width / 2, y: r.top });
                      }}
                      onMouseLeave={() => setManualTooltip(null)}
                    >
                      <MdTouchApp size={18} />
                    </span>
                  )}
                </div>
              );
            }

            const cardHref = item.piece_id
              ? `/aluno/repertorio/pecas/${item.piece_id}`
              : item.exercise_id
                ? `/aluno/repertorio/exercicios/${item.exercise_id}`
                : null;

            return (
              <div
                key={item.id}
                className={`group relative rounded-2xl border border-gray-200 bg-[#F6F6F6] overflow-hidden transition ${cardHref ? "cursor-pointer" : ""}`}
                onClick={() => cardHref && navigate(cardHref)}
              >
                {/* Barra de progresso de fundo */}
                <div
                  className={`absolute inset-y-0 left-0 bg-[#D6E4F0] transition-all duration-500 rounded-l-2xl ${itemPct >= 0.95 ? "rounded-r-2xl" : ""}`}
                  style={{ width: `${itemPct * 100}%` }}
                />
                <div className="relative z-10 flex items-stretch">
                  {/* Botão iniciar — esquerda */}
                  {!item.is_done && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const alreadySecs = studiedSecs[item.id] ?? 0;
                        const totalSecs = (item.duration_minutes ?? 0) * 60;
                        const remainSecs = Math.max(
                          60,
                          totalSecs - alreadySecs,
                        );
                        navigate("/aluno/pomodoro", {
                          state: {
                            planItemId: item.id,
                            title: subtitle ? `${title} — ${subtitle}` : title,
                            durationMinutes: Math.ceil(remainSecs / 60),
                            studentId,
                          },
                        });
                      }}
                      className="shrink-0 flex items-center justify-center px-4 bg-[#D6E4F0] hover:bg-[#4A90C4] text-[#1E3A5F] hover:text-white transition"
                    >
                      <MdPlayArrow size={28} />
                    </button>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-2 pl-3 pr-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold truncate text-gray-800">
                        {title}
                      </p>

                      {item.completed_manually && (
                        <span
                          className="cursor-default select-none shrink-0 text-gray-900"
                          onMouseEnter={(e) => {
                            const r = (
                              e.currentTarget as HTMLElement
                            ).getBoundingClientRect();
                            setManualTooltip({
                              x: r.left + r.width / 2,
                              y: r.top,
                            });
                          }}
                          onMouseLeave={() => setManualTooltip(null)}
                        >
                          <MdTouchApp size={18} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {subtitle || ""}
                      {item.duration_minutes ? (
                        <>
                          {subtitle ? " · " : ""}
                          {studiedSecs[item.id]
                            ? `${Math.floor((studiedSecs[item.id] ?? 0) / 60)}/${item.duration_minutes} min`
                            : `${item.duration_minutes} min`}
                        </>
                      ) : (
                        ""
                      )}
                    </p>
                  </div>

                  {/* Ações rápidas — só para itens não concluídos */}
                  {!item.is_done &&
                    (() => {
                      const isFocusDay =
                        (item.piece_id && item.piece_id === focusDayPieceId) ||
                        (item.exercise_id &&
                          item.exercise_id === focusDayExerciseId);
                      const isFocusWeek =
                        (item.piece_id && item.piece_id === focusWeekPieceId) ||
                        (item.exercise_id &&
                          item.exercise_id === focusWeekExerciseId);
                      const menuOpen = openMenuItemId === item.id;
                      return (
                        <div className="flex flex-row items-center gap-1 pr-4 pl-1 shrink-0">
                          {/* On hover: target (quando não é foco) + menu três pontos */}
                          {!(isFocusDay || isFocusWeek) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick("focus", item);
                              }}
                              className="w-7 h-7 flex items-center justify-center transition opacity-0 group-hover:opacity-100 hover:opacity-70 text-gray-400"
                            >
                              <MdGpsFixed size={18} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (menuOpen) {
                                setOpenMenuItemId(null);
                                setMenuAnchor(null);
                              } else {
                                const r = (
                                  e.currentTarget as HTMLElement
                                ).getBoundingClientRect();
                                setMenuAnchor({ x: r.right, y: r.bottom });
                                setOpenMenuItemId(item.id);
                              }
                            }}
                            className={`w-7 h-7 flex items-center justify-center text-gray-400 transition hover:text-[#1E3A5F] ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                          >
                            <MdMoreVert size={18} />
                          </button>
                          {/* Sempre visíveis: target se foco ativo + indicadores de estado */}
                          {(isFocusDay || isFocusWeek) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick("focus", item);
                              }}
                              className="w-7 h-7 flex items-center justify-center transition hover:opacity-70"
                              style={{
                                color: isFocusDay ? "#4A90C4" : "#1E3A5F",
                              }}
                            >
                              <MdGpsFixed size={18} />
                            </button>
                          )}
                          {item.is_maintenance && (
                            <span
                              className="shrink-0 cursor-default flex items-center justify-center w-5"
                              onMouseEnter={(e) => {
                                const r = (
                                  e.currentTarget as HTMLElement
                                ).getBoundingClientRect();
                                setMaintenanceTooltip({
                                  x: r.left + r.width / 2,
                                  y: r.top,
                                });
                              }}
                              onMouseLeave={() => setMaintenanceTooltip(null)}
                            >
                              <MdBuild size={14} color="#111827" />
                            </span>
                          )}
                          {!item.is_maintenance &&
                            item.moved_from_dow != null && (
                              <span
                                className="shrink-0 cursor-default flex items-center justify-center w-5"
                                onMouseEnter={(e) => {
                                  const r = (
                                    e.currentTarget as HTMLElement
                                  ).getBoundingClientRect();
                                  setMovedTooltip({
                                    x: r.left + r.width / 2,
                                    y: r.top,
                                  });
                                }}
                                onMouseLeave={() => setMovedTooltip(null)}
                              >
                                <MdForward size={14} color="#111827" />
                              </span>
                            )}
                        </div>
                      );
                    })()}
                </div>
              </div>
            );
          })}

          {/* Sessões livres do dia (compactas, inline) */}
          {freeSessions.map((sess) => (
            <div
              key={sess.id}
              className="group flex items-center gap-2 rounded-xl border border-[#B8D4E8] bg-[#D6E4F0] pl-3 pr-4 py-1.5"
            >
              <div className="w-5 h-5 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                <svg
                  width="10"
                  height="10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="white"
                  strokeWidth={3.5}
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-xs text-gray-400 truncate min-w-0 flex-1">
                <span className="font-medium text-gray-500">{sess.label}</span>
                {` · ${sess.minutes} min`}
              </p>
              <button
                onClick={() => deleteSession(sess.id)}
                className="opacity-0 group-hover:opacity-100 transition shrink-0 text-red-400 hover:text-red-600 w-7 h-7 flex items-center justify-center"
              >
                <MdDeleteOutline size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Banner de início rápido */}
      {isToday && (
        <div className="mt-5 bg-[#1E3A5F] rounded-2xl flex items-center gap-3 p-3">
          <button
            onClick={() => { setChangeTimeMinutes(totalMinutes || 60); setShowChangeTime(true); }}
            className="rounded-xl bg-[#D6E4F0] flex items-center justify-center shrink-0 hover:bg-[#c4d9ec] transition"
            style={{ width: 56, height: 56 }}
          >
            <MdTimer size={24} className="text-[#1E3A5F]" />
          </button>
          <button
            onClick={() =>
              navigate("/aluno/pomodoro", {
                state: {
                  title: "Sessão de hoje",
                  durationMinutes: totalMinutes || pomodoroConfig?.work || 25,
                  studentId,
                  autoStart: true,
                  pomodoroConfig: pomodoroConfig ?? undefined,
                },
              })
            }
            id="onboarding-today-start-btn"
            className="flex-1 rounded-xl px-4 py-3 flex items-center justify-center gap-3 hover:bg-white/5 transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <MdPlayArrow size={24} className="text-white ml-0.5" />
            </div>
            <div className="text-left">
              <p className="text-base font-bold text-white">Início rápido</p>
              <p className="text-xs text-white/60 mt-0.5">
                {pomodoroConfig
                  ? `${pomodoroConfig.work} : ${pomodoroConfig.break} min`
                  : "25 : 5 min"}
              </p>
            </div>
          </button>
          <button
            onClick={() => setShowRebalanceConfirm(true)}
            className="rounded-xl bg-[#D6E4F0] flex items-center justify-center shrink-0 hover:bg-[#c4d9ec] transition"
            style={{ width: 56, height: 56 }}
          >
            <MdScale size={24} className="text-[#1E3A5F]" />
          </button>
        </div>
      )}

      {/* Tooltip conclusão manual — fora do card para evitar herança de opacidade */}
      {manualTooltip && (
        <div
          className="fixed z-[9999] pointer-events-none text-white text-xs rounded-xl px-3 py-2 shadow-lg w-44"
          style={{
            backgroundColor: "#1E3A5F",
            top: manualTooltip.y - 8,
            left: Math.min(manualTooltip.x, window.innerWidth - 96),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold mb-0.5">Conclusão manual</p>
          <p
            style={{ color: "rgba(255,255,255,0.75)" }}
            className="leading-snug"
          >
            Não conta XP, badges nem missões.
          </p>
        </div>
      )}

      {maintenanceTooltip && (
        <div
          className="fixed z-[9999] pointer-events-none text-white text-xs rounded-xl px-3 py-2 shadow-lg w-44"
          style={{
            backgroundColor: "#1E3A5F",
            top: maintenanceTooltip.y - 8,
            left: Math.min(maintenanceTooltip.x, window.innerWidth - 96),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold mb-0.5">Tarefa de manutenção</p>
          <p
            style={{ color: "rgba(255,255,255,0.75)" }}
            className="leading-snug"
          >
            Revisão de peça já concluída para manter o nível.
          </p>
        </div>
      )}

      {movedTooltip && (
        <div
          className="fixed z-[9999] pointer-events-none text-white text-xs rounded-xl px-3 py-2 shadow-lg w-44"
          style={{
            backgroundColor: "#1E3A5F",
            top: movedTooltip.y - 8,
            left: Math.min(movedTooltip.x, window.innerWidth - 96),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold mb-0.5">Tarefa movida</p>
          <p
            style={{ color: "rgba(255,255,255,0.75)" }}
            className="leading-snug"
          >
            Esta tarefa foi transferida de outro dia.
          </p>
        </div>
      )}

      {/* Dropdown do menu de três pontos — renderizado fora do card (fixed) */}
      {openMenuItemId &&
        menuAnchor &&
        (() => {
          const menuItem = visibleItems.find((i) => i.id === openMenuItemId);
          if (!menuItem) return null;
          return (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setOpenMenuItemId(null);
                  setMenuAnchor(null);
                }}
              />
              <div
                className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-44"
                style={{
                  top: menuAnchor.y + 4,
                  right: window.innerWidth - menuAnchor.x,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setOpenMenuItemId(null);
                    setMenuAnchor(null);
                    setSwapItem(menuItem);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA] transition"
                >
                  <MdSwapHoriz size={16} color="#4A90C4" />
                  Trocar tarefa
                </button>
                <button
                  onClick={() => {
                    setOpenMenuItemId(null);
                    setMenuAnchor(null);
                    handleActionClick("move", menuItem);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA] transition"
                >
                  <MdArrowForward size={16} color="#4A90C4" />
                  Mover tarefa
                </button>
                <button
                  onClick={() => {
                    setOpenMenuItemId(null);
                    setMenuAnchor(null);
                    setEditDurationItem(menuItem);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA] transition"
                >
                  <MdAccessTime size={16} color="#4A90C4" />
                  Editar tempo
                </button>
                <hr className="border-gray-100 my-1" />
                {!menuItem.is_done && (
                  <button
                    onClick={() => {
                      setOpenMenuItemId(null);
                      setMenuAnchor(null);
                      if (localStorage.getItem(SKIP_KEY)) {
                        toggleDone(menuItem, true);
                      } else {
                        setPendingItem(menuItem);
                      }
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA] transition"
                  >
                    <MdCheckCircle size={16} color="#4A90C4" />
                    Concluir
                  </button>
                )}
                <button
                  onClick={() => {
                    setOpenMenuItemId(null);
                    setMenuAnchor(null);
                    setUngroupConfirmItem(menuItem);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F7FA] transition"
                >
                  <MdCallSplit size={16} color="#4A90C4" />
                  Desagrupar
                </button>
                <hr className="border-gray-100 my-1" />
                <button
                  onClick={() => {
                    setOpenMenuItemId(null);
                    setMenuAnchor(null);
                    handleDeleteItem(menuItem);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
                >
                  <MdDeleteOutline size={16} />
                  Deletar tarefa
                </button>
              </div>
            </>
          );
        })()}

      {/* Modal de trocar tarefa */}
      {swapItem && (
        <SwapPieceModal
          itemTitle={itemDisplay(swapItem).title}
          pieces={activePieces}
          exercises={activeExercises}
          onSelect={(target) => handleSwap(swapItem, target)}
          onClose={() => setSwapItem(null)}
        />
      )}

      {/* Modal de editar tempo */}
      {editDurationItem &&
        (() => {
          const { title } = itemDisplay(editDurationItem);
          return (
            <EditDurationModal
              currentMinutes={editDurationItem.duration_minutes ?? 0}
              itemTitle={title}
              onClose={() => setEditDurationItem(null)}
              onSaveThis={(min) =>
                handleEditDurationThis(editDurationItem, min)
              }
              onSaveAll={(min) => handleEditDurationAll(editDurationItem, min)}
            />
          );
        })()}

      {/* Modal de foco */}
      {showFocusModal && (
        <FocusModal
          items={visibleItems}
          preSelectedPieceId={focusPrePieceId}
          preSelectedExerciseId={focusPreExerciseId}
          onClose={() => {
            setShowFocusModal(false);
            setFocusPrePieceId(null);
            setFocusPreExerciseId(null);
          }}
          onApply={handleApplyFocus}
        />
      )}

      {/* Modal de mover tarefa */}
      {moveTaskItem && (
        <MoveTaskModal
          item={moveTaskItem}
          todayDow={viewDay}
          onClose={() => setMoveTaskItem(null)}
          onMove={handleMoveTask}
        />
      )}

      {/* Modal de confirmação de delete */}
      {deleteConfirmItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-8 px-4"
          onClick={() => setDeleteConfirmItem(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-bold text-gray-800 mb-2">
              Remover{" "}
              <span className="text-[#1E3A5F]">
                {itemDisplay(deleteConfirmItem).title}
              </span>
              ?
            </p>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Você quer distribuir o tempo dessa tarefa nas outras tarefas do
              seu dia?
            </p>
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-[#F5F7FA] transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDelete(deleteConfirmItem, false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-[#F5F7FA] transition"
              >
                Não
              </button>
            </div>
            <button
              onClick={() => executeDelete(deleteConfirmItem, true)}
              className="w-full py-2.5 rounded-xl bg-[#1E3A5F] text-sm text-white font-semibold hover:bg-[#1E3A5F]/90 transition"
            >
              Sim, redistribuir
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmação de ação rápida */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-8 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <p className="text-base font-bold text-gray-800 mb-2">
              {pendingAction.type === "skip"
                ? "Pular esta tarefa hoje?"
                : pendingAction.type === "focus"
                  ? "Dar foco especial a esta tarefa?"
                  : "Mover esta tarefa?"}
            </p>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              {pendingAction.type === "skip"
                ? "O tempo será redistribuído para as outras tarefas do dia."
                : pendingAction.type === "focus"
                  ? "Você pode aumentar o tempo dedicado a esta peça ou exercício hoje ou durante toda a semana."
                  : "A tarefa será movida para outro dia desta semana."}
            </p>
            <button
              onClick={() =>
                setPendingAction((prev) =>
                  prev ? { ...prev, dontShowAgain: !prev.dontShowAgain } : prev,
                )
              }
              className="flex items-center gap-3 mb-6 group"
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                  pendingAction.dontShowAgain
                    ? "bg-[#1E3A5F] border-[#1E3A5F]"
                    : "border-gray-300 group-hover:border-[#4A90C4]"
                }`}
              >
                {pendingAction.dontShowAgain && (
                  <svg
                    width="10"
                    height="10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="white"
                    strokeWidth={3.5}
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-400">
                Não mostrar novamente
              </span>
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const key =
                    pendingAction.type === "skip"
                      ? ACTION_SKIP_KEY
                      : pendingAction.type === "focus"
                        ? ACTION_FOCUS_KEY
                        : ACTION_MOVE_KEY;
                  if (pendingAction.dontShowAgain)
                    localStorage.setItem(key, "1");
                  const { type, item } = pendingAction;
                  setPendingAction(null);
                  executeAction(type, item);
                }}
                className="flex-1 py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação manual */}
      {pendingItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-8 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <p className="text-base font-bold text-gray-800 mb-2">
              Concluir{" "}
              <span className="text-[#1E3A5F]">
                {pendingItem.exercise?.title ??
                  pendingItem.piece?.title ??
                  "item"}
              </span>{" "}
              manualmente
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Você não concluiu uma sessão pomodoro. Deseja marcar como
              concluído mesmo assim?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
              <p className="text-xs text-amber-700 leading-relaxed">
                A conclusão rápida <span className="font-semibold">não conta XP, não dá medalhas e não completa missões do dia.</span> Para ganhar recompensas, conclua pelo Pomodoro.
              </p>
            </div>
            <button
              onClick={() => setSkipConfirm((v) => !v)}
              className="flex items-center gap-3 mb-6 group"
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                  skipConfirm
                    ? "bg-[#1E3A5F] border-[#1E3A5F]"
                    : "border-gray-300 group-hover:border-[#4A90C4]"
                }`}
              >
                {skipConfirm && (
                  <svg
                    width="10"
                    height="10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="white"
                    strokeWidth={3.5}
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-400">
                Não perguntar novamente
              </span>
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingItem(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (skipConfirm) localStorage.setItem(SKIP_KEY, "1");
                  toggleDone(pendingItem, true);
                  setPendingItem(null);
                }}
                className="flex-1 py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition"
              >
                Sim, concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — confirmar desagrupar */}
      {ungroupConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4">
          <div className="bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-6">
            <h2 className="text-base font-bold text-[#1E3A5F] mb-1">Desagrupar tarefa</h2>
            <p className="text-xs text-gray-400 mb-4">
              A tarefa será dividida em blocos do tamanho do seu pomodoro ({pomodoroConfig?.work ?? 25} min).
            </p>

            {/* Exemplo visual fixo: 60min → blocos do pomodoro */}
            {(() => {
              const blockMin = pomodoroConfig?.work ?? 25;
              const exampleTotal = 60;
              const exBlocks: number[] = [];
              let rem = exampleTotal;
              while (rem > 0) { exBlocks.push(Math.min(blockMin, rem)); rem -= blockMin; }
              return (
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex-1 bg-[#F5F7FA] rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Antes</p>
                    <div className="h-7 rounded-lg bg-[#4A90C4]/30 flex items-center justify-center">
                      <span className="text-xs font-semibold text-[#1E3A5F]">{exampleTotal} min</span>
                    </div>
                  </div>

                  <div className="text-[#4A90C4] text-lg font-bold shrink-0">→</div>

                  <div className="flex-1 bg-[#F5F7FA] rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Depois</p>
                    <div className="space-y-1">
                      {exBlocks.map((b, i) => (
                        <div key={i} className="h-5 rounded-md bg-[#1E3A5F]/50 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-white">{b} min</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-3">
              <button onClick={() => setUngroupConfirmItem(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition">Cancelar</button>
              <button onClick={() => { handleUngroup(ungroupConfirmItem); setUngroupConfirmItem(null); }} className="flex-1 py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition">Desagrupar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — alterar tempo disponível hoje */}
      {showChangeTime && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4">
          <div className="bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-6">
            <h2 className="text-base font-bold text-[#1E3A5F] mb-1">Tempo disponível hoje</h2>
            <p className="text-xs text-gray-400 mb-5">As tarefas pendentes serão redistribuídas igualmente.</p>
            <div className="flex items-center gap-4 mb-6">
              <input
                type="range"
                min={10}
                max={240}
                step={5}
                value={changeTimeMinutes}
                onChange={(e) => setChangeTimeMinutes(Number(e.target.value))}
                className="flex-1 accent-[#1E3A5F]"
              />
              <span className="text-lg font-bold text-[#1E3A5F] w-16 text-right">{changeTimeMinutes} min</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowChangeTime(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition">Cancelar</button>
              <button onClick={handleChangeTimeConfirm} className="flex-1 py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — confirmar rebalanceamento */}
      {showRebalanceConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4">
          <div className="bg-white rounded-t-2xl w-full max-w-sm pb-8 pt-5 px-6">
            <h2 className="text-base font-bold text-[#1E3A5F] mb-1">Rebalancear dia</h2>
            <p className="text-xs text-gray-400 mb-4">O tempo restante é dividido igualmente entre as tarefas pendentes.</p>

            {/* Exemplo visual antes → depois */}
            <div className="flex items-center gap-2 mb-6">
              {/* Antes */}
              <div className="flex-1 bg-[#F5F7FA] rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Antes</p>
                {[20, 35, 10].map((min, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-[#4A90C4]/30" style={{ width: `${(min / 35) * 100}%`, minWidth: 8 }} />
                    <span className="text-[10px] text-gray-400 shrink-0">{min}m</span>
                  </div>
                ))}
              </div>

              {/* Seta */}
              <div className="text-[#4A90C4] text-lg font-bold shrink-0">→</div>

              {/* Depois */}
              <div className="flex-1 bg-[#F5F7FA] rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Depois</p>
                {[22, 22, 21].map((min, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-[#1E3A5F]/50" style={{ width: `${(min / 35) * 100}%`, minWidth: 8 }} />
                    <span className="text-[10px] text-gray-400 shrink-0">{min}m</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowRebalanceConfirm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition">Cancelar</button>
              <button onClick={() => { setShowRebalanceConfirm(false); handleEqualizeTime(); }} className="flex-1 py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition">Rebalancear</button>
            </div>
          </div>
        </div>
      )}

    </StudentLayout>
  );
}
