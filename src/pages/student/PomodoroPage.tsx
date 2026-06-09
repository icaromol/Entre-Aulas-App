import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MdPause, MdPlayArrow, MdStop, MdEmojiEvents } from "react-icons/md";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { Button } from "@/components/ui/button";
import { grantXp, ACHIEVEMENT_LABEL } from "@/lib/xpHelpers";
import { formatWeekStart, getMonday } from "@/lib/weekUtils";
import {
  fireBasic,
  fireSideCannons,
  fireStars,
  hasRankUp,
} from "@/lib/confettiEffects";
import { sound } from "@/lib/soundEffects";

interface CyclePreset {
  key: string;
  name: string;
  workMinutes: number;
  breakMinutes: number;
  totalCycles: number;
}

function autoPreset(durationMinutes: number): CyclePreset {
  if (durationMinutes <= 15) {
    return {
      key: "auto",
      name: "Automático",
      workMinutes: Math.max(5, durationMinutes),
      breakMinutes: 3,
      totalCycles: 1,
    };
  }
  if (durationMinutes <= 30) {
    return {
      key: "auto",
      name: "Automático",
      workMinutes: durationMinutes,
      breakMinutes: 5,
      totalCycles: 1,
    };
  }
  if (durationMinutes <= 50) {
    return {
      key: "auto",
      name: "Automático",
      workMinutes: Math.round(durationMinutes / 2),
      breakMinutes: 5,
      totalCycles: 2,
    };
  }
  if (durationMinutes <= 80) {
    return {
      key: "auto",
      name: "Automático",
      workMinutes: Math.round(durationMinutes / 3),
      breakMinutes: 5,
      totalCycles: 3,
    };
  }
  const cycles = Math.max(4, Math.round(durationMinutes / 25));
  return {
    key: "auto",
    name: "Automático",
    workMinutes: 25,
    breakMinutes: 5,
    totalCycles: cycles,
  };
}

type Phase = "idle" | "work" | "break" | "finished";

interface DayItem {
  id: string;
  kind: "checklist";
  title: string;
  subtitle: string;
}


const CIRCUMFERENCE = 2 * Math.PI * 54;

function fmt(s: number) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function fmtStudied(secs: number): string {
  if (secs < 60) return `${secs}s de estudo`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m} min ${s}s de estudo` : `${m} min de estudo`;
}

export default function PomodoroPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const nav = location.state as {
    planItemId?: string;
    title?: string;
    durationMinutes?: number;
    studentId?: string;
    autoStart?: boolean;
  } | null;

  // ── Custom config ──
  const [customWork, setCustomWork] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [customCycles, setCustomCycles] = useState(4);

  // ── Timer ──
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentCycle, setCurrentCycle] = useState(1);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalSecs, setTotalSecs] = useState(0);
  const [showEarlyDialog, setShowEarlyDialog] = useState(false);
  const activeCycle = useRef<CyclePreset | null>(null);
  const startedAt = useRef<string | null>(null);
  const workSecs = useRef(0);

  // ── Finish screen ──
  const [dayItems, setDayItems] = useState<DayItem[]>([]);
  const [workedIds, setWorkedIds] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<"easy" | "ok" | "hard" | "">("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // ── Auto-start ──
  useEffect(() => {
    if (!nav?.autoStart && !nav?.planItemId) return;
    const preset = nav?.planItemId
      ? autoPreset(nav.durationMinutes ?? 25)
      : ({
          key: "classic",
          name: "Clássico",
          workMinutes: 20,
          breakMinutes: 5,
          totalCycles: 1,
        } as CyclePreset);
    activeCycle.current = preset;
    startedAt.current = new Date().toISOString();
    workSecs.current = 0;
    const secs = preset.workMinutes * 60;
    setCurrentCycle(1);
    setCompletedCycles(0);
    setPhase("work");
    setTimeLeft(secs);
    setTotalSecs(secs);
    setIsPaused(false);
    openFinishModal();
  }, []);

  // ── Timer tick ──
  useEffect(() => {
    if ((phase !== "work" && phase !== "break") || isPaused) return;
    const id = setInterval(() => {
      if (phase === "work") workSecs.current += 1;
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, isPaused]);

  // ── Phase transitions ──
  useEffect(() => {
    if (timeLeft !== 0) return;
    if (phase !== "work" && phase !== "break") return;
    const c = activeCycle.current;
    if (!c) return;

    if (phase === "work") {
      const newCompleted = completedCycles + 1;
      setCompletedCycles(newCompleted);

      if (currentCycle < c.totalCycles) {
        // Há mais ciclos — vai para pausa
        sound.pomodoroSection();
        const secs = c.breakMinutes * 60;
        setPhase("break");
        setTimeLeft(secs);
        setTotalSecs(secs);
      } else {
        // Todos os ciclos completos — salva direto
        sound.pomodoroSuccess();
        saveSession();
      }
    } else {
      // Pausa acabou — próximo ciclo de trabalho
      const next = currentCycle + 1;
      setCurrentCycle(next);
      const secs = c.workMinutes * 60;
      setPhase("work");
      setTimeLeft(secs);
      setTotalSecs(secs);
      setIsPaused(false);
    }
  }, [timeLeft, phase, currentCycle, completedCycles]);

  // ── Start ──
  function startSession(preset?: CyclePreset) {
    const c = preset ?? {
      key: "custom",
      name: "Personalizado",
      workMinutes: customWork,
      breakMinutes: customBreak,
      totalCycles: customCycles,
    };
    activeCycle.current = c;
    startedAt.current = new Date().toISOString();
    workSecs.current = 0;
    const secs = c.workMinutes * 60;
    setCurrentCycle(1);
    setCompletedCycles(0);
    setPhase("work");
    setTimeLeft(secs);
    setTotalSecs(secs);
    setIsPaused(false);
    setShowEarlyDialog(false);
    openFinishModal();
  }

  // ── End early ──
  function handleEndEarly() {
    if (completedCycles === 0) {
      setIsPaused(true);
      setShowEarlyDialog(true);
    } else {
      saveSession();
    }
  }

  // ── Fetch items ──
  async function openFinishModal() {
    setLoadingItems(true);
    const sid = nav?.studentId;
    if (!sid) {
      setLoadingItems(false);
      return;
    }

    const [completionsRes, piecesRes, exercisesRes] = await Promise.all([
      supabase
        .from("checklist_completions")
        .select("checklist_item_id")
        .eq("student_id", sid),
      supabase
        .from("pieces")
        .select("id, title, checklist_items(id, title)")
        .eq("student_id", sid)
        .eq("status", "in_progress"),
      supabase
        .from("exercises")
        .select("id, title, checklist_items(id, title)")
        .eq("student_id", sid)
        .eq("status", "active"),
    ]);

    if (completionsRes.error || piecesRes.error || exercisesRes.error) {
      console.error(
        "[PomodoroPage] fetch failed:",
        completionsRes.error ?? piecesRes.error ?? exercisesRes.error,
      );
      setLoadingItems(false);
      return;
    }

    const completedIds = new Set(
      (completionsRes.data ?? []).map((c: any) => c.checklist_item_id),
    );

    const items: DayItem[] = [];

    for (const piece of (piecesRes.data ?? []) as any[]) {
      for (const ci of (piece.checklist_items ?? []) as any[]) {
        if (!completedIds.has(ci.id))
          items.push({
            id: ci.id,
            kind: "checklist",
            title: ci.title,
            subtitle: piece.title,
          });
      }
    }
    for (const ex of (exercisesRes.data ?? []) as any[]) {
      for (const ci of (ex.checklist_items ?? []) as any[]) {
        if (!completedIds.has(ci.id))
          items.push({
            id: ci.id,
            kind: "checklist",
            title: ci.title,
            subtitle: ex.title,
          });
      }
    }

    setDayItems(items);
    setLoadingItems(false);
  }

  // ── Save ──
  async function saveSession() {
    setSaving(true);
    const sid = nav?.studentId;
    const c = activeCycle.current;
    if (!sid || !c) {
      setSaving(false);
      navigate("/aluno/hoje");
      return;
    }

    const endedAt = new Date().toISOString();

    const { data: sessionData, error } = await supabase
      .from("study_sessions")
      .insert({
        student_id: sid,
        cycle_name: c.name,
        cycle_work_minutes: c.workMinutes,
        cycle_break_minutes: c.breakMinutes,
        cycle_total: c.totalCycles,
        started_at: startedAt.current,
        ended_at: endedAt,
        duration_seconds: workSecs.current,
        difficulty_felt: difficulty || null,
        notes: comment || null,
      })
      .select("id")
      .single();

    if (error) {
      if (import.meta.env.DEV)
        console.error("[pomodoro] save error", error.code);
    } else if (sessionData?.id) {
      const minutesXp = Math.floor(workSecs.current / 60);
      const bonusXp = completedCycles * 5;
      const totalXp = minutesXp + bonusXp;
      if (totalXp > 0) {
        const { newAchievements } = await grantXp(
          sid,
          "pomodoro_session",
          sessionData.id,
          null,
          totalXp,
        );
        sound.xpEarn();
        toast.success(
          `+${totalXp} XP · ${bonusXp > 0 ? "Sessão concluída! (+5 bônus)" : "Sessão registrada"}`,
        );
        for (const key of newAchievements) {
          toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`);
        }
        if (hasRankUp(newAchievements)) fireStars();
        else fireBasic();
      }
    }

    const checklistIds = [...workedIds];

    if (checklistIds.length > 0) {
      await supabase.from("checklist_completions").insert(
        checklistIds.map((id) => ({
          checklist_item_id: id,
          student_id: sid,
        })),
      );

      // Verificar se alguma peça chegou a 100%
      const { data: ciRows } = await supabase
        .from("checklist_items")
        .select("piece_id")
        .in("id", checklistIds)
        .not("piece_id", "is", null);

      const pieceIds = [
        ...new Set((ciRows ?? []).map((r: { piece_id: string }) => r.piece_id)),
      ];

      if (pieceIds.length > 0) {
        const [piecesRes, alreadyGrantedRes] = await Promise.all([
          supabase
            .from("pieces")
            .select("id, completion_pct")
            .in("id", pieceIds),
          supabase
            .from("student_xp_events")
            .select("source_id")
            .eq("student_id", sid)
            .eq("reason", "piece_completed")
            .in("source_id", pieceIds),
        ]);

        const alreadyGranted = new Set(
          (alreadyGrantedRes.data ?? []).map((r) => r.source_id),
        );

        for (const piece of piecesRes.data ?? []) {
          if (piece.completion_pct === 100 && !alreadyGranted.has(piece.id)) {
            const { newAchievements: pAch } = await grantXp(
              sid,
              "piece_completed",
              piece.id,
              "musicalidade",
            );
            toast.success("+300 XP · Peça concluída! 🎼");
            for (const key of pAch) {
              toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`);
            }
            if (hasRankUp(pAch)) fireStars();
            fireSideCannons();
          }
        }
      }
    }

    // Vincular session_items aos plan_items da semana atual
    if (sessionData?.id) {
      // Mapa: plan_item_id → peso (nº de checklist_items trabalhados dessa peça/exercício)
      const itemWeight: Record<string, number> = {}

      // 1. Se veio do botão Iniciar de um item específico, peso 1
      if (nav?.planItemId) {
        itemWeight[nav.planItemId] = 1
      }

      // 2. Resolver checklist_items selecionados → plan_items da semana
      if (checklistIds.length > 0) {
        const weekStart = formatWeekStart(getMonday(new Date()))

        // checklist_item → piece_id / exercise_id
        const { data: ciData } = await supabase
          .from("checklist_items")
          .select("piece_id, exercise_id")
          .in("id", checklistIds)
        const ciRows = (ciData ?? []) as { piece_id: string | null; exercise_id: string | null }[]

        const pieceIds    = [...new Set(ciRows.map(r => r.piece_id).filter((x): x is string => !!x))]
        const exerciseIds = [...new Set(ciRows.map(r => r.exercise_id).filter((x): x is string => !!x))]

        if (pieceIds.length > 0 || exerciseIds.length > 0) {
          const { data: plan } = await supabase
            .from("weekly_plans").select("id")
            .eq("student_id", sid).eq("week_start", weekStart).maybeSingle()

          if (plan?.id) {
            // Buscar plan_items cujo piece_id ou exercise_id batam com os trabalhados
            const queries: Promise<{ data: { id: string; piece_id: string | null; exercise_id: string | null }[] | null }>[] = []
            if (pieceIds.length > 0)
              queries.push(supabase.from("plan_items").select("id, piece_id, exercise_id").eq("plan_id", plan.id).in("piece_id", pieceIds) as any)
            if (exerciseIds.length > 0)
              queries.push(supabase.from("plan_items").select("id, piece_id, exercise_id").eq("plan_id", plan.id).in("exercise_id", exerciseIds) as any)

            const results = await Promise.all(queries)
            const matchedPlanItems = results.flatMap(r => r.data ?? [])

            // Para cada checklist_item trabalhado, incrementar o peso do plan_item correspondente
            for (const ci of ciRows) {
              for (const pi of matchedPlanItems) {
                if ((ci.piece_id && ci.piece_id === pi.piece_id) ||
                    (ci.exercise_id && ci.exercise_id === pi.exercise_id)) {
                  // Não sobrescreve se já veio de nav.planItemId
                  if (pi.id !== nav?.planItemId) {
                    itemWeight[pi.id] = (itemWeight[pi.id] ?? 0) + 1
                  }
                }
              }
            }
          }
        }
      }

      const planItemIds = Object.keys(itemWeight)

      if (planItemIds.length > 0) {
        const totalWeight   = Object.values(itemWeight).reduce((s, v) => s + v, 0)
        const totalWorkSecs = workSecs.current

        const rows = planItemIds.map((planItemId) => {
          const weight = itemWeight[planItemId]
          const proportionalSecs = Math.round((weight / totalWeight) * totalWorkSecs)
          // duration_seconds requer migração: ADD COLUMN IF NOT EXISTS duration_seconds integer
          return {
            session_id:       sessionData.id,
            plan_item_id:     planItemId,
            duration_seconds: proportionalSecs,
          }
        })

        const { error: siError } = await supabase.from("session_items").insert(rows)
        if (siError) {
          // Migração ainda não rodada — inserir sem duration_seconds
          await supabase.from("session_items").insert(
            rows.map(({ duration_seconds: _, ...r }) => r)
          )
        }
      }
    }

    toast.success("Sessão registrada!");
    navigate("/aluno/hoje");
  }

  // ── Derived ──
  const progress = totalSecs > 0 ? timeLeft / totalSecs : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const c = activeCycle.current;
  const isWork = phase === "work";

  // ─────────────────────────────────────────────────────
  // IDLE
  // ─────────────────────────────────────────────────────
  if (phase === "idle" && (nav?.autoStart || nav?.planItemId)) {
    return (
      <StudentLayout>
        <p className="text-sm text-gray-400 mt-8 text-center">Iniciando...</p>
      </StudentLayout>
    );
  }

  if (phase === "idle") {
    return (
      <StudentLayout>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[#1E3A5F] flex-1">Pomodoro</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          {[
            {
              label: "Minutos de estudo",
              value: customWork,
              set: setCustomWork,
              min: 1,
              max: 120,
            },
            {
              label: "Minutos de pausa",
              value: customBreak,
              set: setCustomBreak,
              min: 1,
              max: 60,
            },
            {
              label: "Número de ciclos",
              value: customCycles,
              set: setCustomCycles,
              min: 1,
              max: 10,
            },
          ].map((f) => (
            <div key={f.label} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{f.label}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => f.set((v: number) => Math.max(f.min, v - 1))}
                  className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#4A90C4] transition"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-semibold text-[#1E3A5F]">
                  {f.value}
                </span>
                <button
                  onClick={() => f.set((v: number) => Math.min(f.max, v + 1))}
                  className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#4A90C4] transition"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="flex-1 h-12 rounded-2xl text-sm border-gray-200"
          >
            Voltar
          </Button>
          <Button
            onClick={() => startSession()}
            disabled={customWork < 1 || customBreak < 1 || customCycles < 1}
            className="flex-1 h-12 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-2xl text-sm font-semibold"
          >
            Iniciar sessão
          </Button>
        </div>
      </StudentLayout>
    );
  }

  // ─────────────────────────────────────────────────────
  // WORK / BREAK
  // ─────────────────────────────────────────────────────
  if (phase === "work" || phase === "break") {
    return (
      <StudentLayout>
        {/* Dialog de encerramento antecipado */}
        {showEarlyDialog && (
          <div className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center px-4">
            <div
              className="bg-white rounded-2xl p-8 shadow-xl text-center"
              style={{ width: "60vw", minWidth: "280px" }}
            >
              <p className="text-5xl mb-7">😢</p>
              <p className="text-xl font-bold text-gray-800 mb-3">
                Faltam só {Math.ceil(timeLeft / 60)} {Math.ceil(timeLeft / 60) === 1 ? 'minuto' : 'minutos'}!
              </p>
              <p className="text-base text-gray-500 mb-7">
                Você ainda não completou o ciclo e por isso irá perder o XP
                bônus da sessão. Quer finalizar mesmo assim?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowEarlyDialog(false);
                    setIsPaused(false);
                  }}
                  className="flex-1 py-3.5 rounded-xl border border-gray-200 text-base text-gray-600 hover:border-[#4A90C4] transition"
                >
                  Continuar
                </button>
                <button
                  onClick={() => {
                    setShowEarlyDialog(false);
                    saveSession();
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-[#1E3A5F] text-base text-white font-semibold hover:bg-[#1E3A5F]/90 transition"
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cronômetro */}
        <div className="flex flex-col items-center">
          <div
            className={`text-xs font-semibold mb-3 px-3 py-1 rounded-full ${
              isWork
                ? "bg-[#D6E4F0] text-[#1E3A5F]"
                : "bg-green-100 text-green-600"
            }`}
          >
            {isWork ? `Ciclo ${currentCycle} de ${c?.totalCycles}` : "Pausa"}
          </div>

          {/* min(60vw, 60vh) — para no primeiro que chegar */}
          <div
            className="relative"
            style={{ width: "min(60vw, 60vh)", height: "min(60vw, 60vh)" }}
          >
            <svg viewBox="0 0 120 120" className="-rotate-90 w-full h-full">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#F3F4F6"
                strokeWidth="5"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={isWork ? "#1E3A5F" : "#4ADE80"}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-[#1E3A5F] tabular-nums">
                {fmt(timeLeft)}
              </span>
              <span className="text-sm text-gray-400 mt-2">
                {isWork
                  ? completedCycles > 0
                    ? `${completedCycles * (c?.workMinutes ?? 0)} min concluídos`
                    : "em andamento"
                  : "pausa"}
              </span>
            </div>
          </div>

          {/* Dots de ciclos */}
          {c && c.totalCycles > 1 && (
            <div className="flex gap-2 mt-4">
              {Array.from({ length: c.totalCycles }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition ${
                    i < completedCycles
                      ? "bg-[#1E3A5F]"
                      : i === currentCycle - 1 && isWork
                        ? "bg-[#4A90C4]"
                        : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-3 mt-5">
          <Button
            onClick={() => setIsPaused((p) => !p)}
            variant="outline"
            className="flex-1 h-12 rounded-2xl text-sm font-semibold border-gray-200 flex items-center justify-center gap-2"
          >
            {isPaused ? (
              <>
                <MdPlayArrow size={18} /> Retomar
              </>
            ) : (
              <>
                <MdPause size={18} /> Pausar
              </>
            )}
          </Button>
          <Button
            onClick={handleEndEarly}
            variant="outline"
            className="flex-1 h-12 rounded-2xl text-sm font-semibold text-red-500 border-red-200 hover:bg-red-50 flex items-center justify-center gap-2"
          >
            <MdStop size={18} /> Encerrar
          </Button>
        </div>

        {/* Checklist inline */}
        <div className="mt-5 space-y-4">
          {/* O que você está trabalhando */}
          {loadingItems ? (
            <div className="flex justify-center py-4">
              <Spinner size={16} />
            </div>
          ) : (
            dayItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-600 mb-3">
                  Selecione os itens que você está trabalhando.
                </p>
                <div className="space-y-2">
                  {dayItems.map((item) => {
                    const checked = workedIds.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() =>
                          setWorkedIds((prev) => {
                            const next = new Set(prev);
                            checked ? next.delete(item.id) : next.add(item.id);
                            return next;
                          })
                        }
                        className="w-full flex items-center gap-3 text-left"
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                            checked
                              ? "bg-[#1E3A5F] border-[#1E3A5F]"
                              : "border-gray-300"
                          }`}
                        >
                          {checked && (
                            <svg
                              width="10"
                              height="10"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="white"
                              strokeWidth={3}
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Dificuldade */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-600 mb-3">
              Como está sendo?
            </p>
            <div className="flex gap-2">
              {(
                [
                  { key: "easy", label: "Fácil", emoji: "😊" },
                  { key: "ok", label: "Ok", emoji: "😐" },
                  { key: "hard", label: "Difícil", emoji: "😓" },
                ] as const
              ).map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border transition ${
                    difficulty === d.key
                      ? "bg-[#1E3A5F] border-[#1E3A5F] text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-[#4A90C4]"
                  }`}
                >
                  <span className="text-xl">{d.emoji}</span>
                  <span className="text-xs font-medium mt-1">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-600 mb-2">
              Observações{" "}
              <span className="font-normal text-gray-400">(opcional)</span>
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Dificuldades, dúvidas, observações..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition resize-y"
              style={{ minHeight: "72px" }}
            />
          </div>
        </div>
      </StudentLayout>
    );
  }

  // ─────────────────────────────────────────────────────
  // FINISHED
  // ─────────────────────────────────────────────────────
  return (
    <StudentLayout>
      <div className="flex flex-col items-center pt-6 pb-8">
        <div className="w-16 h-16 rounded-full bg-[#D6E4F0] flex items-center justify-center mb-3">
          <MdEmojiEvents size={36} color="#1E3A5F" />
        </div>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Sessão encerrada!</h1>
        <p className="text-sm text-gray-400 mt-1">
          {fmtStudied(workSecs.current)}
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => navigate("/aluno/hoje")}
          variant="outline"
          className="flex-1 h-12 rounded-2xl text-sm text-red-500 border-red-200 hover:bg-red-50"
        >
          Descartar
        </Button>
        <Button
          onClick={saveSession}
          disabled={saving}
          className="flex-1 h-12 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-2xl text-sm font-semibold"
        >
          {saving ? "Salvando..." : "Salvar sessão"}
        </Button>
      </div>
    </StudentLayout>
  );
}
