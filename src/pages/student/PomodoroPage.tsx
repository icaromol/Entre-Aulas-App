import { useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  MdPause,
  MdPlayArrow,
  MdStop,
  MdEmojiEvents,
  MdPictureInPicture,
} from "react-icons/md";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { Button } from "@/components/ui/button";
import { PillSlider } from "@/components/ui/PillSlider";
import { grantXp, ACHIEVEMENT_LABEL } from "@/lib/xpHelpers";
import { formatWeekStart, getMonday, getTodayDayOfWeek } from "@/lib/weekUtils";
import { fireBasic, fireStars, hasRankUp } from "@/lib/confettiEffects";
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

interface ChecklistEntry {
  id: string;
  title: string;
  piece_id: string | null;
  exercise_id: string | null;
}

interface DayGroup {
  sourceId: string;
  sourceTitle: string;
  kind: "piece" | "exercise";
  status: string;
  items: ChecklistEntry[];
  planItemIds: string[];
}

function groupTextColor(status: string): string {
  if (status === "completed") return "text-green-600";
  if (status === "in_progress" || status === "active") return "text-gray-900";
  return "text-gray-300";
}

const CIRCUMFERENCE = 2 * Math.PI * 54;

// ─── Arc Slider ───────────────────────────────────────────────────────────────
// Drag circular para configurar minutos de estudo / pausa

interface ArcSliderProps {
  value: number;
  min: number;
  max: number;
  color: string;
  label: string;
  onChange: (v: number) => void;
}

function ArcSlider({
  value,
  min,
  max,
  color,
  label,
  onChange,
}: ArcSliderProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const R = 38;
  const PERIMETER = 2 * Math.PI * R; // ~238.76
  const START_DEG = 140; // onde o arco começa (convenção Math.atan2)
  const TOTAL_ARC = 260; // graus totais do arco

  const pct = (value - min) / (max - min);
  const filled = pct * TOTAL_ARC; // graus preenchidos
  const filledLen = (filled / 360) * PERIMETER;
  const trackLen = (TOTAL_ARC / 360) * PERIMETER;

  // Offset do arco track: precisa começar em START_DEG
  // SVG stroke começa no ângulo 0 (direita) e vai no sentido horário
  // Para iniciar em START_DEG: rotacionamos o grupo
  const trackGap = PERIMETER - trackLen;
  const filledGap = PERIMETER - filledLen;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!(e.buttons & 1)) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const relative = (angle - START_DEG + 360) % 360;
    const norm = Math.max(0, Math.min(1, relative / TOTAL_ARC));
    onChange(Math.round(min + norm * (max - min)));
  }

  return (
    <div className="flex flex-col items-center select-none w-[38%]">
      <svg
        ref={svgRef}
        viewBox="0 0 100 103"
        width="100%"
        height="auto"
        style={{ cursor: "grab", touchAction: "none" }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={handlePointerMove}
      >
        {/* Grupo rotacionado para que o arco comece em START_DEG */}
        <g transform={`rotate(${START_DEG} 50 50)`}>
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="10"
            strokeDasharray={`${trackLen} ${trackGap}`}
            strokeLinecap="round"
          />
          {/* Arco preenchido */}
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${filledLen} ${filledGap}`}
            strokeLinecap="round"
          />
        </g>
        {/* Valor centralizado */}
        <text
          x="50"
          y="46"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="20"
          fontWeight="bold"
          fill={color}
          fontFamily="inherit"
        >
          {value}
        </text>
        <text
          x="50"
          y="62"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill="#9CA3AF"
          fontFamily="inherit"
        >
          min
        </text>
        {/* Label colado na parte inferior do arco — junto às pontas */}
        <text
          x="50"
          y="97"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fontWeight="600"
          fill="#6B7280"
          fontFamily="inherit"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}


function fmt(s: number) {
  const t = Math.floor(s);
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
}

function fmtStudied(secs: number): string {
  const t = Math.floor(secs);
  if (t < 60) return `${t}s de estudo`;
  const m = Math.floor(t / 60);
  const s = t % 60;
  return s > 0 ? `${m} min ${s}s de estudo` : `${m} min de estudo`;
}

type PlanItemRef = {
  id: string;
  piece_id: string | null;
  exercise_id: string | null;
};

interface PomodoroNavState {
  planItemId?: string;
  title?: string;
  durationMinutes?: number;
  studentId?: string;
  autoStart?: boolean;
  pomodoroConfig?: { work: number; break: number; cycles: number };
}

function parsePomodoroNavState(raw: unknown): PomodoroNavState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const cfg =
    s.pomodoroConfig && typeof s.pomodoroConfig === "object"
      ? (s.pomodoroConfig as { work: number; break: number; cycles: number })
      : undefined;
  return {
    planItemId: typeof s.planItemId === "string" ? s.planItemId : undefined,
    title: typeof s.title === "string" ? s.title : undefined,
    durationMinutes:
      typeof s.durationMinutes === "number" ? s.durationMinutes : undefined,
    studentId: typeof s.studentId === "string" ? s.studentId : undefined,
    autoStart: typeof s.autoStart === "boolean" ? s.autoStart : undefined,
    pomodoroConfig: cfg,
  };
}

async function linkSessionItems(
  sessionId: string,
  studentId: string,
  checklistIds: string[],
  directPlanItemId: string | null,
  totalWorkSecs: number,
  extraPlanItemIds: string[] = [],
): Promise<void> {
  const itemData: Record<
    string,
    { weight: number; piece_id: string | null; exercise_id: string | null }
  > = {};
  const weekStart = formatWeekStart(getMonday(new Date()));
  const todayDow = new Date().getDay();

  if (directPlanItemId) {
    const { data: piRow } = await supabase
      .from("plan_items")
      .select("id, piece_id, exercise_id")
      .eq("id", directPlanItemId)
      .single();
    if (piRow)
      itemData[directPlanItemId] = {
        weight: 1,
        piece_id: piRow.piece_id,
        exercise_id: piRow.exercise_id,
      };
  }

  // Grupos sem checklist_items trabalhados: plan_item_ids diretos
  if (extraPlanItemIds.length > 0) {
    const { data: extraRows } = await supabase
      .from("plan_items")
      .select("id, piece_id, exercise_id")
      .in("id", extraPlanItemIds);
    for (const row of (extraRows ?? []) as any[]) {
      if (!itemData[row.id]) {
        itemData[row.id] = { weight: 1, piece_id: row.piece_id, exercise_id: row.exercise_id };
      }
    }
  }

  if (checklistIds.length > 0) {
    const { data: ciData } = await supabase
      .from("checklist_items")
      .select("piece_id, exercise_id")
      .in("id", checklistIds);
    const ciRows = (ciData ?? []) as {
      piece_id: string | null;
      exercise_id: string | null;
    }[];
    const pieceIds = [
      ...new Set(ciRows.map((r) => r.piece_id).filter((x): x is string => !!x)),
    ];
    const exerciseIds = [
      ...new Set(
        ciRows.map((r) => r.exercise_id).filter((x): x is string => !!x),
      ),
    ];

    if (pieceIds.length > 0 || exerciseIds.length > 0) {
      const { data: plan } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("student_id", studentId)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (plan?.id) {
        const queries: Promise<{ data: PlanItemRef[] | null }>[] = [];
        if (pieceIds.length > 0)
          queries.push(
            supabase
              .from("plan_items")
              .select("id, piece_id, exercise_id")
              .eq("plan_id", plan.id)
              .eq("day_of_week", todayDow)
              .in("piece_id", pieceIds) as any,
          );
        if (exerciseIds.length > 0)
          queries.push(
            supabase
              .from("plan_items")
              .select("id, piece_id, exercise_id")
              .eq("plan_id", plan.id)
              .eq("day_of_week", todayDow)
              .in("exercise_id", exerciseIds) as any,
          );

        const matchedPlanItems = (await Promise.all(queries)).flatMap(
          (r) => r.data ?? [],
        );
        for (const ci of ciRows) {
          for (const pi of matchedPlanItems) {
            const matches =
              (ci.piece_id && ci.piece_id === pi.piece_id) ||
              (ci.exercise_id && ci.exercise_id === pi.exercise_id);
            if (!matches) continue;
            if (!itemData[pi.id])
              itemData[pi.id] = {
                weight: 0,
                piece_id: pi.piece_id,
                exercise_id: pi.exercise_id,
              };
            if (pi.id !== directPlanItemId) itemData[pi.id].weight += 1;
          }
        }
      }
    }
  }

  const entries = Object.entries(itemData);
  if (entries.length === 0) return;

  const totalWeight = entries.reduce((s, [, v]) => s + v.weight, 0) || 1;
  const rows = entries.map(([planItemId, v]) => ({
    session_id: sessionId,
    plan_item_id: planItemId,
    piece_id: v.piece_id,
    exercise_id: v.exercise_id,
    duration_seconds: Math.round((v.weight / totalWeight) * totalWorkSecs),
  }));

  const { error } = await supabase.from("session_items").insert(rows);
  if (error)
    toast.error(
      "Erro ao vincular sessão ao plano. O progresso pode não aparecer hoje.",
    );
}

export default function PomodoroPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const nav = parsePomodoroNavState(location.state);

  // ── Custom config ──
  const [customWork, setCustomWork] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [customCycles, setCustomCycles] = useState(4);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const SKIP_SAVE_KEY = "estudamus_skip_save_pomodoro";

  // Carrega config salva do aluno ao montar (busca por profile_id pois é o que temos no auth)
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("students")
      .select("id, pomodoro_work, pomodoro_break, pomodoro_cycles")
      .eq("profile_id", profile.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.pomodoro_work) setCustomWork(data.pomodoro_work);
        if (data.pomodoro_break) setCustomBreak(data.pomodoro_break);
        if (data.pomodoro_cycles) setCustomCycles(data.pomodoro_cycles);
      });
  }, [profile?.id]);

  async function handleSaveConfig() {
    if (!profile?.id) return;
    setSavingConfig(true);
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("profile_id", profile.id)
      .single();
    if (student?.id) {
      await supabase
        .from("students")
        .update({
          pomodoro_work: customWork,
          pomodoro_break: customBreak,
          pomodoro_cycles: customCycles,
        })
        .eq("id", student.id);
    }
    setSavingConfig(false);
    toast.success("Configuração salva como padrão!");
  }

  // ── Timer ──
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentCycle, setCurrentCycle] = useState(1);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [totalSecs, setTotalSecs] = useState(0);
  const [showEarlyDialog, setShowEarlyDialog] = useState(false);
  // Clock-based timer — immune to browser tab throttling
  const activeCycle = useRef<CyclePreset | null>(null);
  const startedAt = useRef<string | null>(null);
  // phaseStartedAt: Date.now() when the current phase (or resume) began; null when paused
  const phaseStartedAt = useRef<number | null>(null);
  // pausedElapsed: seconds already elapsed before the current run segment
  const pausedElapsed = useRef<number>(0);
  // phaseDuration: total seconds for the current phase
  const phaseDuration = useRef<number>(0);
  // workSecsAccum: real work seconds accumulated across pauses
  const workSecsAccum = useRef<number>(0);
  // finalWorkSecs: frozen at save time, used by the finished screen
  const finalWorkSecs = useRef<number>(0);
  // workPhaseStartedAt: Date.now() when current work phase began (null if paused/break)
  const workPhaseStartedAt = useRef<number | null>(null);
  // onPhaseEnd: stable ref to the transition handler, set after saveSession is defined
  const onPhaseEndRef = useRef<(() => void) | null>(null);
  // transitionFired: prevents the transition from firing more than once per phase end
  const transitionFired = useRef(false);
  const pipWindowRef = useRef<Window | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);

  // timeLeft as real state — React controls batching; interval sets it via getTimeLeft()
  const [timeLeft, setTimeLeft] = useState(0);

  function getTimeLeft(): number {
    if (phaseStartedAt.current === null) {
      return Math.max(0, phaseDuration.current - pausedElapsed.current);
    }
    const elapsed =
      pausedElapsed.current + (Date.now() - phaseStartedAt.current) / 1000;
    return Math.max(0, phaseDuration.current - elapsed);
  }

  // ── Finish screen ──
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [workedIds, setWorkedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // Grupos sem checklist_items: rastreia "trabalhei neste grupo" por sourceId
  const [workedGroupIds, setWorkedGroupIds] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<"easy" | "ok" | "hard" | "">("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // ── Custom items ──
  const [customItems, setCustomItems] = useState<
    { id: string; title: string; type: "piece" | "exercise" | "other" }[]
  >([]);
  const [workedCustomIds, setWorkedCustomIds] = useState<Set<string>>(
    new Set(),
  );
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newCustomTitle, setNewCustomTitle] = useState("");
  const [newCustomType, setNewCustomType] = useState<
    "piece" | "exercise" | "other"
  >("other");

  // ── Timer phase initializer — shared by startSession, auto-start and phase transitions ──
  function initPhase(secs: number, isWorkPhase: boolean) {
    phaseDuration.current = secs;
    pausedElapsed.current = 0;
    phaseStartedAt.current = Date.now();
    workPhaseStartedAt.current = isWorkPhase ? Date.now() : null;
  }

  // ── Document Picture-in-Picture ──
  const openPip = useCallback(async () => {
    if (!("documentPictureInPicture" in window)) {
      toast.error(
        "Seu navegador não suporta Picture-in-Picture de documentos.",
      );
      return;
    }
    try {
      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width: 220,
        height: 220,
      });
      pipWindowRef.current = pip;

      // Mount point — PiP uses inline styles only, no external CSS needed
      const container = pip.document.createElement("div");
      container.style.cssText =
        "width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1E3A5F;";
      pip.document.body.style.margin = "0";
      pip.document.body.appendChild(container);
      pipContainerRef.current = container;

      pip.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        pipContainerRef.current = null;
        setTimeLeft(getTimeLeft());
      });

      setTimeLeft(getTimeLeft());
    } catch {
      // User dismissed the prompt — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-start ──
  useEffect(() => {
    if (!nav?.autoStart && !nav?.planItemId) return;
    const cfg = nav?.pomodoroConfig;
    const preset = nav?.planItemId
      ? autoPreset(nav.durationMinutes ?? cfg?.work ?? 25)
      : cfg
        ? ({
            key: "saved",
            name: "Padrão",
            workMinutes: cfg.work,
            breakMinutes: cfg.break,
            totalCycles: cfg.cycles,
          } as CyclePreset)
        : ({
            key: "classic",
            name: "Clássico",
            workMinutes: 25,
            breakMinutes: 5,
            totalCycles: 1,
          } as CyclePreset);
    activeCycle.current = preset;
    startedAt.current = new Date().toISOString();
    workSecsAccum.current = 0;
    const secs = preset.workMinutes * 60;
    initPhase(secs, true);
    transitionFired.current = false;
    setCurrentCycle(1);
    setCompletedCycles(0);
    setPhase("work");
    setTotalSecs(secs);
    setIsPaused(false);
    openFinishModal();
  }, []);

  // ── Timer tick + phase transition — single interval, all reads from refs ──
  useEffect(() => {
    if ((phase !== "work" && phase !== "break") || isPaused) return;
    const id = setInterval(() => {
      const tl = getTimeLeft();
      setTimeLeft(tl);
      if (tl > 0) {
        transitionFired.current = false;
        return;
      }
      if (transitionFired.current) return;
      transitionFired.current = true;
      onPhaseEndRef.current?.();
    }, 250);
    return () => clearInterval(id);
  }, [phase, isPaused]);

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
    workSecsAccum.current = 0;
    const secs = c.workMinutes * 60;
    initPhase(secs, true);
    transitionFired.current = false;
    setCurrentCycle(1);
    setCompletedCycles(0);
    setPhase("work");
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
    const sid = nav?.studentId ?? profile?.studentId;
    if (!sid) {
      setLoadingItems(false);
      return;
    }

    const weekStart = formatWeekStart(getMonday(new Date()));
    const todayDow = getTodayDayOfWeek();

    // Busca plano da semana atual
    const { data: plan } = await supabase
      .from("weekly_plans")
      .select("id")
      .eq("student_id", sid)
      .eq("week_start", weekStart)
      .maybeSingle();

    let todayPieceIds: string[] = [];
    let todayExerciseIds: string[] = [];
    let planItemOrder: { pieceId: string | null; exerciseId: string | null; planItemId: string }[] = [];

    if (plan?.id) {
      const { data: todayItems } = await supabase
        .from("plan_items")
        .select("id, piece_id, exercise_id")
        .eq("plan_id", plan.id)
        .eq("day_of_week", todayDow)
        .order("position", { ascending: true });

      for (const item of (todayItems ?? []) as any[]) {
        const pid = item.piece_id as string | null;
        const eid = item.exercise_id as string | null;
        if (pid && !todayPieceIds.includes(pid)) todayPieceIds.push(pid);
        if (eid && !todayExerciseIds.includes(eid)) todayExerciseIds.push(eid);
        planItemOrder.push({ pieceId: pid, exerciseId: eid, planItemId: item.id as string });
      }
    }

    const hasFilter = todayPieceIds.length > 0 || todayExerciseIds.length > 0;

    const [piecesRes, exercisesRes, completionsRes] = await Promise.all([
      hasFilter && todayPieceIds.length > 0
        ? supabase
            .from("pieces")
            .select("id, title, status, checklist_items(id, title, piece_id, exercise_id)")
            .in("id", todayPieceIds)
        : !hasFilter
          ? supabase
              .from("pieces")
              .select("id, title, status, checklist_items(id, title, piece_id, exercise_id)")
              .eq("student_id", sid)
              .in("status", ["in_progress", "paused", "future"])
          : Promise.resolve({ data: [], error: null }),
      hasFilter && todayExerciseIds.length > 0
        ? supabase
            .from("exercises")
            .select("id, title, status, checklist_items(id, title, piece_id, exercise_id)")
            .in("id", todayExerciseIds)
        : !hasFilter
          ? supabase
              .from("exercises")
              .select("id, title, status, checklist_items(id, title, piece_id, exercise_id)")
              .eq("student_id", sid)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
      supabase
        .from("checklist_completions")
        .select("checklist_item_id")
        .eq("student_id", sid)
        .gte(
          "completed_at",
          new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
        ),
    ]);

    if ((piecesRes as any).error || (exercisesRes as any).error) {
      setLoadingItems(false);
      return;
    }

    const alreadyDone = new Set(
      (completionsRes.data ?? []).map((c: any) => c.checklist_item_id),
    );
    setCompletedIds(alreadyDone);

    const pieceMap = new Map<string, any>();
    for (const p of ((piecesRes.data ?? []) as any[])) pieceMap.set(p.id, p);
    const exerciseMap = new Map<string, any>();
    for (const e of ((exercisesRes.data ?? []) as any[])) exerciseMap.set(e.id, e);

    const groups: DayGroup[] = [];
    const seenIds = new Set<string>();

    // Mapa sourceId → plan_item_ids para tracking de grupos sem checklist
    const planItemsBySource = new Map<string, string[]>();
    for (const { pieceId, exerciseId, planItemId } of planItemOrder) {
      const sid2 = pieceId ?? exerciseId;
      if (!sid2) continue;
      if (!planItemsBySource.has(sid2)) planItemsBySource.set(sid2, []);
      planItemsBySource.get(sid2)!.push(planItemId);
    }

    if (hasFilter) {
      // Mantém a ordem do plano — inclui grupos SEM checklist_items
      for (const { pieceId, exerciseId } of planItemOrder) {
        if (pieceId && !seenIds.has(pieceId)) {
          const piece = pieceMap.get(pieceId);
          if (piece) {
            seenIds.add(pieceId);
            groups.push({
              sourceId: piece.id,
              sourceTitle: piece.title,
              kind: "piece",
              status: piece.status ?? "in_progress",
              items: (piece.checklist_items ?? []) as ChecklistEntry[],
              planItemIds: planItemsBySource.get(pieceId) ?? [],
            });
          }
        }
        if (exerciseId && !seenIds.has(exerciseId)) {
          const ex = exerciseMap.get(exerciseId);
          if (ex) {
            seenIds.add(exerciseId);
            groups.push({
              sourceId: ex.id,
              sourceTitle: ex.title,
              kind: "exercise",
              status: ex.status ?? "active",
              items: (ex.checklist_items ?? []) as ChecklistEntry[],
              planItemIds: planItemsBySource.get(exerciseId) ?? [],
            });
          }
        }
      }
    } else {
      // Fallback: sem plano, mostra tudo ativo (mantém filtro de checklist_items)
      for (const piece of ((piecesRes.data ?? []) as any[])) {
        if ((piece.checklist_items ?? []).length === 0) continue;
        groups.push({
          sourceId: piece.id,
          sourceTitle: piece.title,
          kind: "piece",
          status: piece.status ?? "in_progress",
          items: piece.checklist_items as ChecklistEntry[],
          planItemIds: [],
        });
      }
      for (const ex of ((exercisesRes.data ?? []) as any[])) {
        if ((ex.checklist_items ?? []).length === 0) continue;
        groups.push({
          sourceId: ex.id,
          sourceTitle: ex.title,
          kind: "exercise",
          status: ex.status ?? "active",
          items: ex.checklist_items as ChecklistEntry[],
          planItemIds: [],
        });
      }
    }

    setDayGroups(groups);

    // Pré-seleciona grupo quando veio de um item específico do plano
    if (nav?.planItemId && groups.length > 0) {
      const { data: piRow } = await supabase
        .from("plan_items")
        .select("piece_id, exercise_id")
        .eq("id", nav.planItemId)
        .single();

      if (piRow) {
        const matchId = piRow.piece_id ?? piRow.exercise_id;
        const matchGroup = groups.find((g) => g.sourceId === matchId);
        if (matchGroup) {
          setWorkedIds(new Set(matchGroup.items.map((i) => i.id)));
          setExpandedGroups(new Set([matchGroup.sourceId]));
        }
      }
    }

    setLoadingItems(false);
  }

  // ── Save ──
  async function saveSession() {
    setSaving(true);
    const sid = nav?.studentId ?? profile?.studentId;
    const c = activeCycle.current;
    if (!sid || !c) {
      setSaving(false);
      navigate("/aluno/hoje");
      return;
    }

    const endedAt = new Date().toISOString();

    // Flush any in-progress work segment
    if (phase === "work" && workPhaseStartedAt.current !== null) {
      workSecsAccum.current += (Date.now() - workPhaseStartedAt.current) / 1000;
      workPhaseStartedAt.current = null;
    }
    const totalWorkSecs = Math.round(workSecsAccum.current);
    finalWorkSecs.current = totalWorkSecs;

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
        duration_seconds: totalWorkSecs,
        difficulty_felt: difficulty || null,
        notes: comment || null,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Não foi possível salvar a sessão. Tente novamente.");
      setSaving(false);
      return;
    }

    // ── Feedback imediato — não espera o banco ──
    const minutesXp = Math.floor(totalWorkSecs / 60);
    const bonusXp = completedCycles * 5;
    const totalXp = minutesXp + bonusXp;
    if (totalXp > 0) {
      sound.xpEarn();
      toast.success(
        `+${totalXp} XP · ${bonusXp > 0 ? "Sessão concluída! (+5 bônus)" : "Sessão registrada"}`,
      );
      fireBasic();
    }

    // ── Persistência em background + navigate imediato ──
    const checklistIds = [...workedIds];
    const sessionId = sessionData!.id;
    const selectedCustom = customItems.filter((ci) => workedCustomIds.has(ci.id));
    // Plan_item_ids de grupos sem checklist_items marcados como trabalhados
    const extraPlanItemIds = dayGroups
      .filter((g) => g.items.length === 0 && workedGroupIds.has(g.sourceId))
      .flatMap((g) => g.planItemIds);

    navigate("/aluno/hoje");

    // Tudo abaixo roda após o redirect, sem bloquear o usuário
    Promise.all([
      totalXp > 0
        ? grantXp(sid, "pomodoro_session", sessionId, null, totalXp).then(
            ({ newAchievements }) => {
              for (const key of newAchievements)
                toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`);
              if (hasRankUp(newAchievements)) fireStars();
            },
          )
        : Promise.resolve(),

      completedIds.size > 0
        ? supabase
            .from("checklist_completions")
            .select("checklist_item_id")
            .eq("student_id", sid)
            .in("checklist_item_id", [...completedIds])
            .then(async ({ data: existing }) => {
              const existingSet = new Set(
                (existing ?? []).map((r: any) => r.checklist_item_id),
              );
              const toInsert = [...completedIds].filter(
                (id) => !existingSet.has(id),
              );
              if (toInsert.length === 0) return;

              await supabase.from("checklist_completions").insert(
                toInsert.map((id) => ({
                  checklist_item_id: id,
                  student_id: sid,
                  session_id: sessionId,
                  completed_at: new Date().toISOString(),
                })),
              );

              // Check if any piece reached 100% and auto-complete it
              const { data: ciRows } = await supabase
                .from("checklist_items")
                .select("piece_id")
                .in("id", toInsert)
                .not("piece_id", "is", null);

              const pieceIds = [
                ...new Set(
                  (ciRows ?? []).map((r: any) => r.piece_id as string),
                ),
              ];
              await Promise.all(
                pieceIds.map(async (pid) => {
                  const { data: allItems } = await supabase
                    .from("checklist_items")
                    .select("id, is_optional")
                    .eq("piece_id", pid);
                  const mandatory = (allItems ?? []).filter(
                    (i: any) => !i.is_optional,
                  );
                  if (mandatory.length === 0) return;

                  const { data: doneRows } = await supabase
                    .from("checklist_completions")
                    .select("checklist_item_id")
                    .eq("student_id", sid)
                    .in(
                      "checklist_item_id",
                      mandatory.map((i: any) => i.id),
                    );
                  const pct = Math.round(
                    ((doneRows ?? []).length / mandatory.length) * 100,
                  );
                  if (pct < 100) return;

                  const [, { data: xpExisting }] = await Promise.all([
                    supabase
                      .from("pieces")
                      .update({ status: "completed" })
                      .eq("id", pid),
                    supabase
                      .from("student_xp_events")
                      .select("id")
                      .eq("student_id", sid)
                      .eq("reason", "piece_completed")
                      .eq("source_id", pid)
                      .maybeSingle(),
                  ]);
                  if (!xpExisting) {
                    toast.success("🎉 Peça concluída! +10 XP");
                    await grantXp(sid, "piece_completed", pid, null, 10);
                  }
                }),
              );
            })
        : Promise.resolve(),

      linkSessionItems(
        sessionId,
        sid,
        checklistIds,
        nav?.planItemId ?? null,
        totalWorkSecs,
        extraPlanItemIds,
      ),

      selectedCustom.length > 0
        ? (async () => {
            const perItem = Math.round(
              totalWorkSecs / Math.max(1, selectedCustom.length + 1),
            );
            for (const ci of selectedCustom) {
              if (ci.type === "piece") {
                const { data: newPiece } = await supabase
                  .from("pieces")
                  .insert({
                    student_id: sid,
                    title: ci.title,
                    status: "in_progress",
                  })
                  .select("id")
                  .single();
                if (newPiece) {
                  await supabase.from("session_items").insert({
                    session_id: sessionId,
                    plan_item_id: null,
                    piece_id: newPiece.id,
                    duration_seconds: perItem,
                  });
                }
              } else if (ci.type === "exercise") {
                const { data: newEx } = await supabase
                  .from("exercises")
                  .insert({
                    student_id: sid,
                    title: ci.title,
                    status: "active",
                    category: "other",
                  })
                  .select("id")
                  .single();
                if (newEx) {
                  await supabase.from("session_items").insert({
                    session_id: sessionId,
                    plan_item_id: null,
                    exercise_id: newEx.id,
                    duration_seconds: perItem,
                  });
                }
              }
              // type === "other": não salva no banco
            }
          })()
        : Promise.resolve(),
    ]).catch(() => {
      toast.error(
        "Alguns dados da sessão não foram salvos. Verifique sua conexão.",
      );
    });
  }

  // ── Phase-end handler — updated each render so it closes over latest state ──
  onPhaseEndRef.current = () => {
    const c = activeCycle.current;
    if (!c) return;

    if (phase === "work") {
      if (workPhaseStartedAt.current !== null) {
        workSecsAccum.current +=
          (Date.now() - workPhaseStartedAt.current) / 1000;
        workPhaseStartedAt.current = null;
      }
      if (currentCycle < c.totalCycles) {
        sound.pomodoroSection();
        const secs = c.breakMinutes * 60;
        initPhase(secs, false);
        setCompletedCycles((n) => n + 1);
        setTotalSecs(secs);
        setPhase("break");
      } else {
        sound.pomodoroSuccess();
        setCompletedCycles((n) => n + 1);
        saveSession();
      }
    } else {
      const secs = c.workMinutes * 60;
      initPhase(secs, true);
      setCurrentCycle((n) => n + 1);
      setTotalSecs(secs);
      setIsPaused(false);
      setPhase("work");
    }
  };

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
    const skipSave = localStorage.getItem(SKIP_SAVE_KEY) === "true";

    function handleStartClick() {
      if (skipSave) {
        startSession();
      } else {
        setShowSaveModal(true);
      }
    }

    function handleModalSave(save: boolean) {
      if (dontAskAgain) localStorage.setItem(SKIP_SAVE_KEY, "true");
      setShowSaveModal(false);
      if (save) handleSaveConfig();
      startSession();
    }

    return (
      <StudentLayout>
        {/* Modal de confirmação de salvar */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
              <h2 className="text-base font-bold text-[#1E3A5F] mb-1">Salvar configuração?</h2>
              <p className="text-sm text-gray-400 mb-5">Quer salvar estes tempos como seu padrão para o início rápido?</p>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleModalSave(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-[#4A90C4] transition"
                >
                  Não salvar
                </button>
                <button
                  onClick={() => handleModalSave(true)}
                  className="flex-1 py-2.5 rounded-xl bg-[#1E3A5F] text-sm font-medium text-white hover:bg-[#1E3A5F]/90 transition"
                >
                  Salvar
                </button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setDontAskAgain(v => !v)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    dontAskAgain ? "bg-[#1E3A5F] border-[#1E3A5F]" : "bg-white border-gray-300"
                  }`}
                >
                  {dontAskAgain && (
                    <svg width="9" height="7" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-400">Não perguntar novamente</span>
              </label>
            </div>
          </div>
        )}

        {/* Arc sliders — estudo e pausa */}
        <div
          id="onboarding-pomodoro-cycles"
          className="flex justify-center items-center gap-[14%] pt-4 mb-10 mx-auto w-full max-w-lg"
        >
          <ArcSlider value={customWork}  min={1} max={60} color="#1E3A5F" label="Estudo" onChange={setCustomWork} />
          <ArcSlider value={customBreak} min={1} max={30} color="#374151" label="Pausa"  onChange={setCustomBreak} />
        </div>

        {/* Cycle slider — container */}
        <div className="mx-auto w-full max-w-lg bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-2">
          <p className="text-[10px] font-bold text-[#1E3A5F] uppercase tracking-widest mb-3 text-center">
            Ciclos
          </p>
          <PillSlider value={customCycles} min={1} max={4} onChange={(v) => setCustomCycles(v)} />
        </div>

        {/* Botão salvar configuração — secundário */}
        <div className="mx-auto w-full max-w-lg mt-6">
          <button
            onClick={() => handleSaveConfig()}
            disabled={savingConfig}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:border-[#4A90C4] hover:text-[#1E3A5F] transition disabled:opacity-50"
          >
            {savingConfig ? "Salvando..." : "Salvar configuração"}
          </button>
        </div>

        {/* Iniciar sessão */}
        <Button
          onClick={handleStartClick}
          disabled={customWork < 1 || customBreak < 1 || customCycles < 1}
          className="w-full mt-3 h-12 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-2xl text-sm font-semibold max-w-lg mx-auto block"
        >
          Iniciar sessão
        </Button>
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
                Faltam só {Math.ceil(timeLeft / 60)}{" "}
                {Math.ceil(timeLeft / 60) === 1 ? "minuto" : "minutos"}!
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
        <div
          id="onboarding-pomodoro-timer"
          className="flex flex-col items-center relative"
        >
          {/* PiP button — only show if API is available and PiP not already open */}
          {"documentPictureInPicture" in window && !pipWindowRef.current && (
            <button
              onClick={openPip}
              title="Abrir mini-timer"
              className="absolute top-0 right-0 text-[#1E3A5F] opacity-50 hover:opacity-100 transition"
            >
              <MdPictureInPicture size={20} />
            </button>
          )}
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
            onClick={() => {
              setIsPaused((p) => {
                const pausing = !p;
                if (pausing) {
                  // Freeze: save elapsed so far
                  if (phaseStartedAt.current !== null) {
                    pausedElapsed.current +=
                      (Date.now() - phaseStartedAt.current) / 1000;
                    phaseStartedAt.current = null;
                  }
                  // Also accumulate work seconds if in work phase
                  if (phase === "work" && workPhaseStartedAt.current !== null) {
                    workSecsAccum.current +=
                      (Date.now() - workPhaseStartedAt.current) / 1000;
                    workPhaseStartedAt.current = null;
                  }
                } else {
                  // Resume: restart wall-clock references
                  phaseStartedAt.current = Date.now();
                  if (phase === "work") workPhaseStartedAt.current = Date.now();
                }
                return pausing;
              });
            }}
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
            <div
              id="onboarding-pomodoro-checklist"
              className="bg-white rounded-2xl border border-gray-100 p-4"
            >
              <p className="text-sm font-semibold text-gray-600 mb-3">
                Selecione os itens que você está trabalhando.
              </p>
              {dayGroups.length > 0 && (
                <div className="space-y-2">
                  {dayGroups.map((group) => {
                    const hasItems = group.items.length > 0;
                    const expanded = expandedGroups.has(group.sourceId);

                    // Grupo SEM checklist_items: 2 estados via workedGroupIds
                    if (!hasItems) {
                      const worked = workedGroupIds.has(group.sourceId);
                      return (
                        <div key={group.sourceId} className="pt-3 first:pt-0">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                setWorkedGroupIds((prev) => {
                                  const n = new Set(prev);
                                  n.has(group.sourceId)
                                    ? n.delete(group.sourceId)
                                    : n.add(group.sourceId);
                                  return n;
                                })
                              }
                              className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition ${
                                worked
                                  ? "bg-[#1E3A5F]"
                                  : "border-2 border-gray-300"
                              }`}
                            />
                            <span className={`text-sm font-semibold truncate ${groupTextColor(group.status)}`}>
                              {group.sourceTitle}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // Grupo COM checklist_items: 3 estados + expansão
                    const groupChecked = group.items.every((ci) =>
                      workedIds.has(ci.id),
                    );
                    const groupIndeterminate =
                      !groupChecked &&
                      group.items.some((ci) => workedIds.has(ci.id));

                    const groupAllDone = group.items.every((ci) =>
                      completedIds.has(ci.id),
                    );

                    // Cicla: neutro → selecionado → concluído (todos) → neutro
                    // Banco só é tocado no saveSession ao finalizar
                    function cycleGroup() {
                      if (groupAllDone) {
                        setCompletedIds((prev) => {
                          const n = new Set(prev);
                          group.items.forEach((ci) => n.delete(ci.id));
                          return n;
                        });
                        setWorkedIds((prev) => {
                          const n = new Set(prev);
                          group.items.forEach((ci) => n.delete(ci.id));
                          return n;
                        });
                      } else if (groupChecked || groupIndeterminate) {
                        const toAdd = group.items.filter(
                          (ci) => !completedIds.has(ci.id),
                        );
                        setCompletedIds((prev) => {
                          const n = new Set(prev);
                          toAdd.forEach((ci) => n.add(ci.id));
                          return n;
                        });
                        setWorkedIds((prev) => {
                          const n = new Set(prev);
                          group.items.forEach((ci) => n.add(ci.id));
                          return n;
                        });
                      } else {
                        setWorkedIds((prev) => {
                          const n = new Set(prev);
                          group.items.forEach((ci) => n.add(ci.id));
                          return n;
                        });
                      }
                    }

                    return (
                      <div key={group.sourceId} className="pt-3 first:pt-0">
                        {/* Linha do grupo (peça/exercício) */}
                        <div className="flex items-center gap-3">
                          {/* Círculo 3 estados: neutro / azul (selecionado) / verde+check (concluído) */}
                          <button
                            onClick={cycleGroup}
                            className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition ${
                              groupAllDone
                                ? "bg-green-500"
                                : groupChecked
                                  ? "bg-[#1E3A5F]"
                                  : groupIndeterminate
                                    ? "bg-[#4A90C4]/40"
                                    : "border-2 border-gray-300"
                            }`}
                          >
                            {groupAllDone && (
                              <svg
                                width="9"
                                height="9"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="white"
                                strokeWidth={3}
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setExpandedGroups((prev) => {
                                const next = new Set(prev);
                                next.has(group.sourceId)
                                  ? next.delete(group.sourceId)
                                  : next.add(group.sourceId);
                                return next;
                              })
                            }
                            className="flex-1 flex items-center justify-between gap-2 text-left py-0.5"
                          >
                            <span className={`text-sm font-semibold truncate ${groupTextColor(group.status)}`}>
                              {group.sourceTitle}
                            </span>
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="#9CA3AF"
                              strokeWidth={2}
                              className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                            >
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </button>
                        </div>

                        {/* Itens do checklist (expandidos) */}
                        {expanded && (
                          <div className="mt-2 ml-2.5 space-y-3 border-l-2 border-gray-200 pl-3">
                            {group.items.map((ci) => {
                              const checked = workedIds.has(ci.id);
                              const done = completedIds.has(ci.id);

                              // Banco só é tocado no saveSession ao finalizar
                              function cycleItem() {
                                if (done) {
                                  setCompletedIds((prev) => {
                                    const n = new Set(prev);
                                    n.delete(ci.id);
                                    return n;
                                  });
                                  setWorkedIds((prev) => {
                                    const n = new Set(prev);
                                    n.delete(ci.id);
                                    return n;
                                  });
                                } else if (checked) {
                                  setCompletedIds((prev) =>
                                    new Set(prev).add(ci.id),
                                  );
                                } else {
                                  setWorkedIds((prev) =>
                                    new Set(prev).add(ci.id),
                                  );
                                }
                              }

                              return (
                                <div
                                  key={ci.id}
                                  className="flex items-center gap-2"
                                >
                                  {/* Círculo 3 estados */}
                                  <button
                                    onClick={cycleItem}
                                    className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition ${
                                      done
                                        ? "bg-green-500"
                                        : checked
                                          ? "bg-[#1E3A5F]"
                                          : "border-2 border-gray-300"
                                    }`}
                                  >
                                    {done && (
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
                                  </button>
                                  <span
                                    onClick={cycleItem}
                                    className={`text-sm truncate transition cursor-pointer ${done ? "line-through text-gray-300" : "text-gray-600"}`}
                                  >
                                    {ci.title}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Custom items */}
              {customItems.length > 0 && (
                <div className={`space-y-2 ${dayGroups.length > 0 ? "mt-3 pt-3 border-t border-gray-100" : ""}`}>
                  {customItems.map((ci) => {
                    const worked = workedCustomIds.has(ci.id);
                    const typeLabel =
                      ci.type === "piece"
                        ? "Peça"
                        : ci.type === "exercise"
                          ? "Exercício"
                          : "Outro";
                    return (
                      <div key={ci.id} className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setWorkedCustomIds((prev) => {
                              const n = new Set(prev);
                              n.has(ci.id) ? n.delete(ci.id) : n.add(ci.id);
                              return n;
                            })
                          }
                          className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition ${
                            worked
                              ? "bg-[#1E3A5F]"
                              : "border-2 border-gray-300"
                          }`}
                        />
                        <span className="flex-1 text-sm text-gray-700 truncate">
                          {ci.title}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {typeLabel}
                        </span>
                        <button
                          onClick={() =>
                            setCustomItems((prev) =>
                              prev.filter((x) => x.id !== ci.id),
                            )
                          }
                          className="shrink-0 text-gray-300 hover:text-red-400 transition text-base leading-none"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Adicionar personalizado */}
              {!showCustomForm ? (
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-[#4A90C4] hover:text-[#1E3A5F] transition font-medium"
                >
                  <span className="text-base leading-none">+</span> Adicionar personalizado
                </button>
              ) : (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={newCustomTitle}
                    onChange={(e) => setNewCustomTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCustomTitle.trim()) {
                        const id = crypto.randomUUID();
                        setCustomItems((prev) => [
                          ...prev,
                          { id, title: newCustomTitle.trim(), type: newCustomType },
                        ]);
                        setWorkedCustomIds((prev) => new Set(prev).add(id));
                        setNewCustomTitle("");
                        setShowCustomForm(false);
                      }
                      if (e.key === "Escape") {
                        setNewCustomTitle("");
                        setShowCustomForm(false);
                      }
                    }}
                    placeholder="Nome do item…"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#4A90C4]"
                  />
                  <div className="flex gap-1.5">
                    {(["piece", "exercise", "other"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewCustomType(t)}
                        className={`flex-1 text-xs py-1.5 rounded-lg border transition font-medium ${
                          newCustomType === t
                            ? "bg-[#1E3A5F] border-[#1E3A5F] text-white"
                            : "border-gray-200 text-gray-500 hover:border-[#4A90C4]"
                        }`}
                      >
                        {t === "piece" ? "Peça" : t === "exercise" ? "Exercício" : "Outro"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!newCustomTitle.trim()) return;
                        const id = crypto.randomUUID();
                        setCustomItems((prev) => [
                          ...prev,
                          { id, title: newCustomTitle.trim(), type: newCustomType },
                        ]);
                        setWorkedCustomIds((prev) => new Set(prev).add(id));
                        setNewCustomTitle("");
                        setShowCustomForm(false);
                      }}
                      disabled={!newCustomTitle.trim()}
                      className="flex-1 bg-[#1E3A5F] text-white text-xs font-semibold py-2 rounded-xl disabled:opacity-40 hover:bg-[#1E3A5F]/90 transition"
                    >
                      Adicionar
                    </button>
                    <button
                      onClick={() => {
                        setNewCustomTitle("");
                        setShowCustomForm(false);
                      }}
                      className="flex-1 border border-gray-200 text-gray-500 text-xs font-semibold py-2 rounded-xl hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
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

        {/* Document PiP portal */}
        {pipContainerRef.current &&
          ReactDOM.createPortal(
            <div style={{ textAlign: "center", padding: "16px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  marginBottom: "12px",
                  color: isWork ? "#D6E4F0" : "#4ADE80",
                  letterSpacing: "0.05em",
                }}
              >
                {isWork ? `Ciclo ${currentCycle}/${c?.totalCycles}` : "PAUSA"}
              </div>
              <div
                style={{
                  fontSize: "52px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {fmt(timeLeft)}
              </div>
              {isPaused && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#8BA9C4",
                    marginTop: "10px",
                  }}
                >
                  pausado
                </div>
              )}
            </div>,
            pipContainerRef.current,
          )}
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
          {fmtStudied(finalWorkSecs.current)}
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
