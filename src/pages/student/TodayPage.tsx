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
  MdFlashOn,
  MdKeyboardDoubleArrowLeft,
} from "react-icons/md";
import { ChangeTimeModal } from "@/components/student/ChangeTimeModal";
import { ContinuityCard } from "@/components/student/ContinuityCard";
import { Button } from "@/components/ui/button";
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

function itemDisplay(item: PlanItem): {
  title: string;
  subtitle: string;
  maintenanceIcon: boolean;
} {
  if (item.is_maintenance) {
    return {
      title: "Manutenção",
      subtitle: item.piece?.title ?? "—",
      maintenanceIcon: true,
    };
  }
  if (item.exercise_id && item.exercise) {
    return {
      title: item.exercise.title,
      subtitle: item.programa?.title ?? "—",
      maintenanceIcon: false,
    };
  }
  if (item.piece_id && item.piece) {
    return {
      title: item.piece.title,
      subtitle: item.programa?.title ?? "—",
      maintenanceIcon: false,
    };
  }
  return { title: "—", subtitle: "", maintenanceIcon: false };
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
function redistributeDayItems(
  items: PlanItem[],
  newTotalMinutes: number,
): PlanItem[] {
  const doneItems = items.filter((i) => i.is_done);
  const undoneItems = [...items.filter((i) => !i.is_done)].sort(
    (a, b) => a.position - b.position,
  );

  const doneMinutes = doneItems.reduce(
    (s, i) => s + (i.duration_minutes ?? 0),
    0,
  );
  const available = Math.max(0, newTotalMinutes - doneMinutes);

  if (available < 5 || undoneItems.length === 0) return items;

  // Sessão Essencial: ≤ 20 min disponíveis — mantém itens de maior prioridade até esgatar budget
  if (available <= 20) {
    let remaining = available;
    const updated = undoneItems.map((item) => {
      if (remaining >= 5) {
        const dur = Math.min(item.duration_minutes ?? 5, remaining);
        remaining -= dur;
        return { ...item, duration_minutes: dur };
      }
      return { ...item, duration_minutes: 0 };
    });
    return [...doneItems, ...updated];
  }

  // Redistribuição proporcional
  const currentTotal = undoneItems.reduce(
    (s, i) => s + (i.duration_minutes ?? 0),
    0,
  );

  if (currentTotal <= 0) {
    const perItem = Math.max(5, Math.round(available / undoneItems.length));
    return [
      ...doneItems,
      ...undoneItems.map((i) => ({ ...i, duration_minutes: perItem })),
    ];
  }

  const ratio = available / currentTotal;
  const scaled = undoneItems.map((i) => ({
    ...i,
    duration_minutes: Math.max(
      5,
      Math.round((i.duration_minutes ?? 0) * ratio),
    ),
  }));

  // Ajusta diferença de arredondamento no item de maior prioridade
  const scaledTotal = scaled.reduce((s, i) => s + (i.duration_minutes ?? 0), 0);
  const diff = available - scaledTotal;
  if (diff !== 0) {
    scaled[0] = {
      ...scaled[0],
      duration_minutes: Math.max(5, (scaled[0].duration_minutes ?? 0) + diff),
    };
  }

  return [...doneItems, ...scaled];
}

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
  const [planGenerating, setPlanGenerating] = useState(false);
  const [showChangeTime, setShowChangeTime] = useState(false);
  const [essentialMode, setEssentialMode] = useState(false);
  const [showContinuityModal, setShowContinuityModal] = useState(false);

  const monday = useMemo(() => getMonday(new Date()), []);
  const weekStart = useMemo(() => formatWeekStart(monday), [monday]);
  const viewDate = new Date(monday);
  viewDate.setDate(viewDate.getDate() + (viewDay === 0 ? 6 : viewDay - 1));
  const displayDate = viewDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
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
      const { data: student } = await supabase
        .from("students")
        .select("teacher_id, pomodoro_work, pomodoro_break, pomodoro_cycles")
        .eq("id", sid)
        .single();
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

  async function handleChangeTime(newMinutes: number) {
    const redistributed = redistributeDayItems(items, newMinutes);
    const isEssential = redistributed.some(
      (i) => !i.is_done && i.duration_minutes === 0,
    );

    setItems(redistributed);
    setEssentialMode(isEssential);
    setShowChangeTime(false);

    const undone = redistributed.filter((i) => !i.is_done);
    await Promise.all(
      undone.map((i) =>
        supabase
          .from("plan_items")
          .update({ duration_minutes: i.duration_minutes })
          .eq("id", i.id),
      ),
    );

    if (isEssential) {
      toast.success("Sessão Essencial ativada — foco no que mais importa");
    } else {
      toast.success(`Plano adaptado para ${newMinutes} min`);
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
        duration_minutes, position, is_done, done_at, is_maintenance, completed_manually,
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
  const visibleItems = items.filter(
    (i) => i.duration_minutes !== 0 || i.is_done,
  );

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

  // Minutos estudados: segundos reais de session_items + itens concluídos manualmente + sessões livres
  const studiedSecsTotal = items.reduce((s, i) => {
    if (i.is_done && i.completed_manually)
      return s + (i.duration_minutes ?? 0) * 60;
    return s + (studiedSecs[i.id] ?? 0);
  }, 0);
  const studiedMinutes =
    Math.floor(studiedSecsTotal / 60) +
    freeSessions.reduce((s, f) => s + f.minutes, 0);

  const denominator = totalMinutes > 0 ? totalMinutes : studiedMinutes;
  const pct =
    denominator > 0
      ? Math.min(100, Math.round((studiedMinutes / denominator) * 100))
      : 0;

  const total = visibleItems.length + freeSessions.length;

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

      {/* Header com navegação de dias */}
      <div
        id="onboarding-today-nav"
        className="flex items-center justify-between mb-10 mt-8"
      >
        <button
          onClick={() => setViewDay((d) => (d + 6) % 7)}
          className="p-2 rounded-xl hover:bg-gray-100 transition cursor-pointer shrink-0"
        >
          <MdChevronLeft size={22} className="text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center mx-2">
          <div className="flex items-center gap-3">
            <div className="shrink-0 text-right">
              <p className="text-7xl font-black text-[#1E3A5F] leading-none">
                {dayNum}
              </p>
            </div>
            <div>
              <h1 className="text-4xl font-normal text-[#1E3A5F] leading-none">
                {getDayExtendedLabel(viewDay)}
              </h1>
              <p className="text-sm text-gray-400 mt-1 mx-0.5">{monthLabel}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setViewDay((d) => (d + 1) % 7)}
          className="p-2 rounded-xl hover:bg-gray-100 transition cursor-pointer shrink-0"
        >
          <MdChevronRight size={22} className="text-gray-400" />
        </button>
      </div>

      {/* Progresso do dia — barra clicável */}
      {total > 0 && (
        <button
          className="w-full mb-5 cursor-pointer px-4"
          onClick={() => setShowChangeTime(true)}
        >
          <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-green-500"
              style={{ width: `${pct}%` }}
            />
            {/* Texto cinza escuro — visível sobre o fundo cinza */}
            <div className="absolute inset-0 flex items-center px-2.5">
              <span className="text-[9px] font-bold text-gray-400 leading-none whitespace-nowrap">
                {studiedMinutes} / {totalMinutes}
              </span>
            </div>
            {/* Texto branco — clipado à largura da barra verde, só aparece quando barra > 0 */}
            {pct > 0 && (
              <div
                className="absolute inset-y-0 left-0 overflow-hidden transition-all duration-500 flex items-center px-2.5"
                style={{ width: `${pct}%` }}
              >
                <span className="text-[9px] font-bold text-white leading-none whitespace-nowrap">
                  {studiedMinutes} / {totalMinutes}
                </span>
              </div>
            )}
          </div>
        </button>
      )}

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
                <MdKeyboardDoubleArrowLeft size={24} color="white" />
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
          {visibleItems.map((item) => {
            const { title, subtitle, maintenanceIcon } = itemDisplay(item);

            const itemPct = item.duration_minutes
              ? Math.min(
                  1,
                  (studiedSecs[item.id] ?? 0) / (item.duration_minutes * 60),
                )
              : item.is_done
                ? 1
                : 0;

            return (
              <div
                key={item.id}
                className={`relative rounded-2xl border border-gray-200 bg-[#F6F6F6] overflow-hidden transition ${item.is_done ? "opacity-70" : ""}`}
              >
                {/* Barra de progresso de fundo */}
                <div
                  className="absolute inset-y-0 left-0 bg-[#DBEAFE] transition-all duration-500 rounded-2xl"
                  style={{ width: `${itemPct * 100}%` }}
                />
                <div className="relative z-10 flex items-stretch">
                  {/* Botão iniciar — esquerda */}
                  {!item.is_done && (
                    <button
                      onClick={() => {
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
                      <MdPlayArrow size={26} />
                    </button>
                  )}

                  {/* Info */}
                  <div className={`flex-1 min-w-0 py-3 ${item.is_done ? "px-4" : "pl-3 pr-4"}`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${item.is_done ? "line-through text-gray-400" : "text-gray-800"}`}
                      >
                        {maintenanceIcon ? `Manutenção · ${title}` : title}
                      </p>
                      {item.completed_manually && (
                        <span
                          className="text-[#1E3A5F] font-bold text-sm leading-none cursor-default select-none shrink-0"
                          onMouseEnter={(e) => {
                            const r = (
                              e.target as HTMLElement
                            ).getBoundingClientRect();
                            setManualTooltip({
                              x: r.left + r.width / 2,
                              y: r.top,
                            });
                          }}
                          onMouseLeave={() => setManualTooltip(null)}
                        >
                          *
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {maintenanceIcon ? "" : subtitle}
                      {item.duration_minutes ? (
                        <>
                          {!maintenanceIcon && subtitle ? " · " : ""}
                          {studiedSecs[item.id]
                            ? `${Math.floor((studiedSecs[item.id] ?? 0) / 60)}/${item.duration_minutes} min`
                            : `${item.duration_minutes} min`}
                        </>
                      ) : (
                        ""
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Sessões livres do dia (read-only, já concluídas) */}
          {freeSessions.map((sess) => (
            <div
              key={sess.id}
              className="group rounded-2xl border border-gray-100 opacity-70 hover:opacity-100 transition"
              style={{ background: "#D6E4F0" }}
            >
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="shrink-0">
                  <div className="w-6 h-6 rounded-full bg-[#1E3A5F] border-2 border-[#1E3A5F] flex items-center justify-center">
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
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate line-through text-gray-400">
                    {sess.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Sessão livre · {sess.minutes} min
                  </p>
                </div>
                <button
                  onClick={() => deleteSession(sess.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"
                >
                  <MdDeleteOutline size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banner de início rápido */}
      {isToday && (
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
          className="mt-5 w-full bg-[#1E3A5F] rounded-2xl px-5 py-5 flex items-center justify-center gap-4 hover:bg-[#1E3A5F]/90 transition cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <MdPlayArrow size={28} className="text-white ml-1" />
          </div>
          <div className="text-left">
            <p className="text-base font-bold text-white">Início rápido</p>
            <p className="text-xs text-white/60 mt-0.5">
              {pomodoroConfig
                ? `${pomodoroConfig.work} min · ${pomodoroConfig.break} min pausa`
                : "25 min · 5 min pausa"}
            </p>
          </div>
        </button>
      )}

      {isToday && (
        <div className="flex justify-center mt-6">
          <Button
            variant="text"
            onClick={() =>
              navigate("/aluno/pomodoro", { state: { studentId } })
            }
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            ou configure sua sessão
          </Button>
        </div>
      )}

      {/* Tooltip conclusão manual — fora do card para evitar herança de opacidade */}
      {manualTooltip && (
        <div
          className="fixed z-[9999] pointer-events-none text-white text-xs rounded-xl px-3 py-2 shadow-lg w-44"
          style={{
            backgroundColor: "#1E3A5F",
            top: manualTooltip.y - 8,
            left: manualTooltip.x,
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

      {/* Modal de alterar tempo */}
      {showChangeTime && (
        <ChangeTimeModal
          onClose={() => setShowChangeTime(false)}
          currentMinutes={totalMinutes}
          onConfirm={handleChangeTime}
        />
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
            <p className="text-sm text-gray-400 mb-6">
              Você não concluiu uma sessão pomodoro. Deseja marcar como
              concluído mesmo assim?
            </p>
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
    </StudentLayout>
  );
}
