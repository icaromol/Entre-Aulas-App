import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  useParams,
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { isValidUUID } from "@/lib/utils";
import { DEFAULT_CHECKLIST } from "@/lib/defaultChecklist";
import {
  MdArrowBack,
  MdMusicNote,
  MdSchool,
  MdLibraryMusic,
  MdCalendarMonth,
  MdAccessTime,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdAdd,
  MdMic,
  MdPiano,
  MdTrendingUp,
  MdBarChart,
  MdEmojiEvents,
  MdGraphicEq,
  MdSync,
} from "react-icons/md";
import Avatar from "boring-avatars";
import { supabase } from "@/lib/supabase";
import { PROGRAM_TYPES } from "@/lib/programTypes";
import { getMonday, formatWeekStart, formatWeekLabel } from "@/lib/weekUtils";
import { Spinner } from "@/components/ui/Spinner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { StudentJornadaTab } from "@/components/teacher/StudentJornadaTab";
import { AVATAR_COLORS } from "@/lib/colors";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  instrument: string;
  level: string;
  status: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
}

interface Availability {
  day_of_week: number;
  is_active: boolean;
  minutes_available: number | null;
}

interface Piece {
  id: string;
  title: string;
  composer: string | null;
  status: string;
  completion_pct: number;
}

interface Exercise {
  id: string;
  title: string;
  category: string;
  status: string;
}

interface Programa {
  id: string;
  title: string;
  type: string;
  deadline: string | null;
  status: string;
}

interface PlanItemLocal {
  id: string;
  day_of_week: number;
  piece_id: string | null;
  exercise_id: string | null;
  program_id: string | null;
  duration_minutes: number | null;
  position: number;
  is_done: boolean;
  is_maintenance: boolean;
  piece?: { title: string; composer: string | null } | null;
  exercise?: { title: string; category: string } | null;
  programa?: { title: string; type: string } | null;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const levelLabel: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

function instrumentIcon(instrument: string) {
  const s = instrument.toLowerCase();
  if (
    ["piano", "teclado", "órgão", "orgao", "cravo"].some((k) => s.includes(k))
  )
    return MdPiano;
  if (
    [
      "voz",
      "canto",
      "vocal",
      "soprano",
      "tenor",
      "contralto",
      "barítono",
      "baritono",
    ].some((k) => s.includes(k))
  )
    return MdMic;
  if (
    [
      "flauta",
      "sax",
      "trompete",
      "clarinete",
      "oboé",
      "oboe",
      "trombone",
      "tuba",
      "sopro",
      "fagote",
      "cors",
    ].some((k) => s.includes(k))
  )
    return MdGraphicEq;
  if (
    [
      "bateria",
      "percussão",
      "percussao",
      "cajón",
      "cajon",
      "tambor",
      "bumbo",
    ].some((k) => s.includes(k))
  )
    return MdGraphicEq;
  return MdMusicNote; // violão, guitarra, baixo, violino, ukulele, banjo, etc.
}

function levelIcon(level: string) {
  if (level === "beginner") return MdSchool;
  if (level === "intermediate") return MdTrendingUp;
  if (level === "advanced") return MdEmojiEvents;
  return MdSchool;
}

const pieceStatusLabel: Record<string, string> = {
  in_progress: "Em andamento",
  completed: "Concluída",
  paused: "Pausada",
  future: "Repertório futuro",
};

const exerciseCategoryLabel: Record<string, string> = {
  technique: "Técnica",
  other: "Outro",
};

const exerciseStatusLabel: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  completed: "Concluído",
};

function programIcon(type: string) {
  const Icon = (PROGRAM_TYPES[type] ?? PROGRAM_TYPES.outro).Icon;
  return <Icon size={20} className="text-white" />;
}

function daysUntilLabel(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + "T00:00:00");
  const days = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return "passou";
  if (days === 0) return "hoje";
  return `em ${days} dias`;
}

function getPlanWeekStart(offset: number): string {
  const d = getMonday(new Date());
  d.setDate(d.getDate() + offset * 7);
  return formatWeekStart(d);
}

function planDayDate(weekStart: string, dayOfWeek: number): string {
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type TabKey = "plans" | "repertoire" | "programs" | "journey";
type RepertoireTab = "pieces" | "exercises";

export default function StudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const menuRef = useRef<HTMLDivElement>(null);

  const [student, setStudent] = useState<Student | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const rawTab = searchParams.get("tab");
  const initialTab: TabKey =
    rawTab === "programs"
      ? "programs"
      : rawTab === "repertoire"
        ? "repertoire"
        : rawTab === "journey"
          ? "journey"
          : rawTab === "plans"
            ? "plans"
            : "plans";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [subTab, setSubTab] = useState<RepertoireTab>(
    rawTab === "exercises" ? "exercises" : "pieces",
  );
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Plans tab
  const [planWeekOffset, setPlanWeekOffset] = useState(0);
  const [planItems, setPlanItems] = useState<PlanItemLocal[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [editingPlanItem, setEditingPlanItem] = useState<PlanItemLocal | null>(
    null,
  );

  // Batch import
  const [importMode, setImportMode] = useState<"pieces" | "exercises" | null>(
    null,
  );
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [editDuration, setEditDuration] = useState(0);
  const [savingPlanItem, setSavingPlanItem] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (studentId) fetchAll();
  }, [studentId]);

  useEffect(() => {
    if (activeTab !== "plans" || !studentId) return;
    let cancelled = false;
    async function load() {
      setPlanLoading(true);
      const ws = getPlanWeekStart(planWeekOffset);
      const { data: plan } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("student_id", studentId!)
        .eq("week_start", ws)
        .maybeSingle();
      if (cancelled) return;
      if (!plan) {
        setHasPlan(false);
        setPlanItems([]);
        setPlanLoading(false);
        return;
      }
      setHasPlan(true);
      const { data: items } = await supabase
        .from("plan_items")
        .select(
          "id, day_of_week, piece_id, exercise_id, program_id, duration_minutes, position, is_done, is_maintenance, piece:pieces(title, composer), exercise:exercises(title, category), programa:programas(title, type)",
        )
        .eq("plan_id", plan.id)
        .order("position");
      if (cancelled) return;
      setPlanItems((items ?? []) as unknown as PlanItemLocal[]);
      setPlanLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, planWeekOffset, studentId]);

  async function fetchAll() {
    const [studentRes, availRes, piecesRes, exercisesRes, programasRes] =
      await Promise.all([
        supabase.from("students").select("*").eq("id", studentId!).single(),
        supabase
          .from("student_availability")
          .select("*")
          .eq("student_id", studentId!)
          .order("day_of_week"),
        supabase
          .from("pieces")
          .select("id, title, composer, status, completion_pct")
          .eq("student_id", studentId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("exercises")
          .select("id, title, category, status")
          .eq("student_id", studentId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("programas")
          .select("id, title, type, deadline, status")
          .eq("student_id", studentId!)
          .neq("status", "archived")
          .order("created_at", { ascending: false }),
      ]);

    if (studentRes.error || piecesRes.error || exercisesRes.error) {
      console.error(
        "[StudentProfilePage] fetch failed:",
        studentRes.error ?? piecesRes.error ?? exercisesRes.error,
      );
      setFetchError(
        "Não foi possível carregar os dados do aluno. Tente recarregar a página.",
      );
      setLoading(false);
      return;
    }

    setStudent(studentRes.data);
    setAvailability(availRes.data ?? []);
    setPieces(piecesRes.data ?? []);
    setExercises(exercisesRes.data ?? []);
    setProgramas(programasRes.data ?? []);
    setLoading(false);
  }

  async function savePlanItemDuration(id: string, duration: number) {
    setSavingPlanItem(true);
    await supabase
      .from("plan_items")
      .update({ duration_minutes: duration })
      .eq("id", id);
    setPlanItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, duration_minutes: duration } : i)),
    );
    setSavingPlanItem(false);
    setEditingPlanItem(null);
    toast.success("Duração atualizada");
  }

  async function deletePlanItem(id: string) {
    await supabase.from("plan_items").delete().eq("id", id);
    setPlanItems((prev) => prev.filter((i) => i.id !== id));
    setEditingPlanItem(null);
    toast.success("Tarefa removida");
  }

  async function handleDelete() {
    if (!student) return;
    if (
      !confirm(
        `Excluir ${student.first_name} ${student.last_name}? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setDeleting(true);
    await supabase.from("students").delete().eq("id", studentId!);
    navigate("/professor/alunos");
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
      const createdPieces = data ?? [];
      if (createdPieces.length > 0) {
        await supabase.from("checklist_items").insert(
          createdPieces.flatMap((p: any) =>
            DEFAULT_CHECKLIST.map((item) => ({
              piece_id: p.id,
              title: item.title,
              category: item.category,
              position: item.position,
              is_optional: item.is_optional,
            })),
          ),
        );
      }
      setPieces((prev) => [
        ...prev,
        ...createdPieces.map((p: any) => ({ ...p, checklist_items: [] })),
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
    const n = names.length;
    toast.success(
      `${n} ${importMode === "pieces" ? (n === 1 ? "peça criada" : "peças criadas") : n === 1 ? "exercício criado" : "exercícios criados"}!`,
    );
  }

  if (!isValidUUID(studentId)) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </TeacherLayout>
    );
  }

  if (fetchError) {
    return (
      <TeacherLayout>
        <p className="text-sm text-red-500 text-center py-12">{fetchError}</p>
      </TeacherLayout>
    );
  }

  if (!student) {
    return (
      <TeacherLayout>
        <p className="text-sm text-red-400">Aluno não encontrado.</p>
      </TeacherLayout>
    );
  }

  const activeDays = availability.filter((d) => d.is_active);
  const totalMinutes = activeDays.reduce(
    (sum, d) => sum + (d.minutes_available ?? 0),
    0,
  );

  return (
    <TeacherLayout>
      {/* Modal de Convite */}
      {showInvite && (
        <div
          className="fixed inset-0 bg-black/40 z-20 flex items-end justify-center"
          onClick={() => setShowInvite(false)}
        >
          <div
            className="bg-white rounded-t-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#153b50]">
                Link de convite
              </h2>
              <button
                onClick={() => setShowInvite(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Compartilhe este link com {student.first_name} para ele criar a
              senha de acesso.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={`${window.location.origin}/cadastro?invite=${studentId}`}
                className="flex-1 px-3 py-2 rounded-lg border border-[#b2f0fb]/30 bg-white text-xs text-gray-600 outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/cadastro?invite=${studentId}`,
                  );
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 2000);
                }}
                className="px-4 py-2 rounded-lg bg-[#153b50] text-white text-xs font-medium hover:bg-[#153b50]/90 transition whitespace-nowrap"
              >
                {inviteCopied ? "✓ Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Informações */}
      {showInfo && (
        <div
          className="fixed inset-0 bg-black/40 z-20 flex items-end justify-center"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="bg-white rounded-t-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#153b50]">
                Informações
              </h2>
              <button
                onClick={() => setShowInfo(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Contato
                </h3>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">E-mail</span>
                  <span className="text-xs text-gray-700">
                    {student.contact_email ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">Telefone</span>
                  <span className="text-xs text-gray-700">
                    {student.contact_phone ?? "—"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Disponibilidade semanal
                </h3>
                {availability.map((d) => (
                  <div
                    key={d.day_of_week}
                    className="flex items-center justify-between"
                  >
                    <span
                      className={`text-xs font-medium ${d.is_active ? "text-gray-700" : "text-gray-300"}`}
                    >
                      {DAYS[d.day_of_week]}
                    </span>
                    {d.is_active ? (
                      <span className="text-xs text-[#b2f0fb] font-medium">
                        {d.minutes_available} min
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                ))}
              </div>
              {student.notes && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Observações
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {student.notes}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="mt-5 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#b2f0fb] transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/professor/alunos"
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <MdArrowBack size={20} />
        </Link>
        <div className="shrink-0 rounded-full overflow-hidden">
          <Avatar
            size={40}
            name={`${student.first_name} ${student.last_name}`}
            variant="beam"
            colors={AVATAR_COLORS}
          />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#153b50]">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {[student.contact_email, student.contact_phone]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>

        {/* ⋯ menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="w-8 h-8 flex flex-col items-center justify-center gap-[3px] rounded-lg hover:bg-gray-100 transition"
            aria-label="Mais opções"
          >
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            <span className="w-1 h-1 rounded-full bg-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-44 z-10">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowInfo(true);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Informações
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setInviteCopied(false);
                  setShowInvite(true);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Criar convite
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  navigate(`/professor/alunos/${studentId}/editar`);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Editar
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleDelete();
                }}
                disabled={deleting}
                className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition disabled:opacity-50"
              >
                {deleting ? "..." : "Excluir aluno"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards: instrumento + nível */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          {(() => {
            const Icon = instrumentIcon(student.instrument);
            return <Icon size={32} className="mx-auto mb-2 text-[#b2f0fb]" />;
          })()}
          <p className="text-sm font-bold text-[#153b50] truncate">
            {student.instrument}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Instrumento</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          {(() => {
            const Icon = levelIcon(student.level);
            return <Icon size={32} className="mx-auto mb-2 text-[#b2f0fb]" />;
          })()}
          <p className="text-sm font-bold text-[#153b50]">
            {levelLabel[student.level] ?? student.level}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Nível</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdMusicNote size={16} className="mx-auto mb-1 text-[#b2f0fb]" />
          <p className="text-2xl font-bold text-[#153b50]">{pieces.length}</p>
          <p className="text-xs text-gray-400 mt-1">Peças</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdSchool size={16} className="mx-auto mb-1 text-[#b2f0fb]" />
          <p className="text-2xl font-bold text-[#153b50]">
            {exercises.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Exercícios</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdAccessTime size={16} className="mx-auto mb-1 text-[#b2f0fb]" />
          <p className="text-2xl font-bold text-[#153b50]">{totalMinutes}</p>
          <p className="text-xs text-gray-400 mt-1">min/semana</p>
          <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 mt-1.5">
            {activeDays.map((d) => (
              <span key={d.day_of_week} className="text-[10px] text-gray-400">
                {DAYS[d.day_of_week]} {d.minutes_available}m
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        id="onboarding-teacher-tabs"
        className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5"
      >
        {(
          [
            { key: "plans", label: "Planejamentos", Icon: MdCalendarMonth },
            { key: "repertoire", label: "Repertório", Icon: MdMusicNote },
            { key: "programs", label: "Programas", Icon: MdLibraryMusic },
            { key: "journey", label: "Jornada", Icon: MdBarChart },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === tab.key
                ? "bg-white text-[#153b50] shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <tab.Icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Planejamentos */}
      {activeTab === "plans" &&
        (() => {
          const ws = getPlanWeekStart(planWeekOffset);
          const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
          return (
            <div>
              {/* Navegação de semana */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setPlanWeekOffset((o) => o - 1)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition"
                >
                  <MdChevronLeft size={20} className="text-gray-400" />
                </button>
                <div className="text-center">
                  <p className="text-sm font-bold text-[#153b50]">
                    {formatWeekLabel(ws)}
                  </p>
                  {planWeekOffset === 0 && (
                    <p className="text-[10px] text-[#b2f0fb] font-semibold uppercase tracking-wide mt-0.5">
                      semana atual
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setPlanWeekOffset((o) => o + 1)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition"
                >
                  <MdChevronRight size={20} className="text-gray-400" />
                </button>
              </div>

              {/* Botão gerar */}
              <button
                id="onboarding-teacher-plan-btn"
                onClick={() =>
                  navigate(`/professor/alunos/${studentId}/planejamento`)
                }
                className={`w-full mb-4 rounded-2xl px-4 py-3 flex items-center justify-between transition group ${
                  hasPlan
                    ? "bg-gray-50 border border-gray-200 hover:border-[#b2f0fb]"
                    : "bg-[#b2f0fb] hover:bg-[#b2f0fb]/90"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${hasPlan ? "bg-[#f5f5f5]" : "bg-white/15"}`}
                  >
                    <MdCalendarMonth
                      size={18}
                      className={hasPlan ? "text-[#b2f0fb]" : "text-white"}
                    />
                  </div>
                  <p
                    className={`font-semibold text-sm ${hasPlan ? "text-[#153b50]" : "text-white"}`}
                  >
                    {hasPlan
                      ? "Regerar planejamento"
                      : "Gerar planejamento de estudos"}
                  </p>
                </div>
                <MdChevronRight
                  size={18}
                  className={
                    hasPlan
                      ? "text-gray-400 group-hover:text-[#b2f0fb]"
                      : "text-white/60 group-hover:text-white"
                  }
                />
              </button>

              {/* Board de dias */}
              {planLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : activeDays.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 px-8 py-10 text-center">
                  <p className="text-sm text-gray-400">
                    Nenhuma disponibilidade cadastrada.
                  </p>
                </div>
              ) : (
                <div className="board-scroll flex flex-col gap-3 md:flex-row md:items-start md:overflow-x-auto pb-3">
                  {activeDays.map((avail) => {
                    const dayTasks = planItems.filter(
                      (i) => i.day_of_week === avail.day_of_week,
                    );
                    const totalMin = dayTasks.reduce(
                      (s, t) => s + (t.duration_minutes ?? 0),
                      0,
                    );
                    return (
                      <div
                        key={avail.day_of_week}
                        className="bg-white rounded-2xl border border-gray-100 overflow-hidden md:flex-1 md:min-w-48"
                      >
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-700">
                              {DAY_SHORT[avail.day_of_week]}
                            </p>
                            <p className="text-xs text-gray-400">
                              {planDayDate(ws, avail.day_of_week)}
                            </p>
                          </div>
                          {totalMin > 0 && (
                            <span className="text-xs font-semibold text-[#b2f0fb]">
                              {totalMin} min
                            </span>
                          )}
                        </div>
                        <div className="p-3 space-y-2">
                          {dayTasks.length === 0 ? (
                            <p className="text-xs text-gray-300 text-center py-3">
                              {hasPlan ? "Nenhuma tarefa" : "Sem planejamento"}
                            </p>
                          ) : (
                            dayTasks.map((task) => {
                              const title = task.is_maintenance
                                ? `Manutenção · ${task.piece?.title ?? "—"}`
                                : (task.piece?.title ??
                                  task.exercise?.title ??
                                  "—");
                              const cardBg = task.is_maintenance
                                ? "bg-gray-100 hover:bg-gray-100/70"
                                : task.exercise_id
                                  ? "bg-rose-50 hover:bg-rose-100/80"
                                  : "bg-[#f5f5f5]/60 hover:bg-[#f5f5f5]";
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => {
                                    setEditingPlanItem(task);
                                    setEditDuration(
                                      task.duration_minutes ?? 15,
                                    );
                                  }}
                                  className={`w-full text-left rounded-xl p-3 transition group ${cardBg}`}
                                >
                                  <div className="flex items-start gap-2">
                                    {task.is_maintenance && (
                                      <MdSync
                                        size={14}
                                        className="shrink-0 text-[#b2f0fb]"
                                      />
                                    )}
                                    <p className="text-sm font-medium text-gray-700 flex-1 leading-snug line-clamp-2">
                                      {title}
                                    </p>
                                    {task.is_done && (
                                      <span className="shrink-0 w-4 h-4 rounded-full bg-[#153b50] flex items-center justify-center mt-0.5">
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
                                      </span>
                                    )}
                                  </div>
                                  {task.programa && (
                                    <p className="text-xs text-gray-400 mt-1 truncate">
                                      {task.programa.title}
                                    </p>
                                  )}
                                  <p className="text-xs font-semibold text-[#b2f0fb] mt-1">
                                    {task.duration_minutes} min
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sheet de edição de tarefa */}
              {editingPlanItem && (
                <div
                  className="fixed inset-0 bg-black/40 z-30 flex items-end"
                  onClick={() => setEditingPlanItem(null)}
                >
                  <div
                    className="bg-white rounded-t-2xl px-6 pt-6 pb-8 w-full max-w-lg mx-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-base font-bold text-[#153b50] line-clamp-2">
                          {editingPlanItem.is_maintenance
                            ? `Manutenção · ${editingPlanItem.piece?.title ?? "—"}`
                            : (editingPlanItem.piece?.title ??
                              editingPlanItem.exercise?.title ??
                              "—")}
                        </p>
                        {editingPlanItem.programa && (
                          <p className="text-sm text-gray-400 mt-1 truncate">
                            {editingPlanItem.programa.title}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setEditingPlanItem(null)}
                        className="text-gray-400 shrink-0"
                      >
                        <MdClose size={22} />
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-8 mb-3">
                      Duração
                    </p>
                    <div className="flex items-center gap-4 mb-10">
                      <input
                        type="number"
                        min={5}
                        max={180}
                        value={editDuration}
                        onChange={(e) =>
                          setEditDuration(Number(e.target.value))
                        }
                        className="w-20 text-center border border-gray-200 rounded-xl px-2 py-2.5 text-base font-semibold text-[#153b50] outline-none focus:border-[#b2f0fb]"
                      />
                      <span className="text-sm text-gray-400">min</span>
                      <input
                        type="range"
                        min={5}
                        max={180}
                        step={5}
                        value={editDuration}
                        onChange={(e) =>
                          setEditDuration(Number(e.target.value))
                        }
                        className="flex-1 accent-[#b2f0fb] h-2"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => deletePlanItem(editingPlanItem.id)}
                        className="flex-1 py-3 rounded-xl border border-red-100 text-red-400 text-sm font-semibold hover:bg-red-50 transition"
                      >
                        Remover tarefa
                      </button>
                      <button
                        onClick={() =>
                          savePlanItemDuration(editingPlanItem.id, editDuration)
                        }
                        disabled={savingPlanItem}
                        className="flex-1 py-3 rounded-xl bg-[#153b50] text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {savingPlanItem ? "..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* Tab: Repertório (Peças + Exercícios) */}
      {activeTab === "repertoire" && (
        <div>
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
            {[
              { key: "pieces" as const, label: "Peças", Icon: MdMusicNote },
              {
                key: "exercises" as const,
                label: "Exercícios",
                Icon: MdSchool,
              },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${
                  subTab === t.key
                    ? "bg-white text-[#153b50] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <t.Icon size={13} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Peças */}
          {subTab === "pieces" && (
            <div className="space-y-3">
              {pieces.length === 0 ? (
                <EmptyState
                  title="Nenhuma peça ainda"
                  description="Adicione a primeira peça do repertório."
                />
              ) : (
                pieces.map((piece) => (
                  <Link
                    key={piece.id}
                    to={`/professor/alunos/${studentId}/pecas/${piece.id}`}
                    className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#b2f0fb] transition"
                  >
                    <div className="relative w-10 h-10 shrink-0">
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
                                ? "#0993ae"
                                : "#b2f0fb"
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
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {piece.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {piece.composer ?? "—"} ·{" "}
                        {pieceStatusLabel[piece.status] ?? piece.status}
                      </p>
                    </div>
                    <MdChevronRight
                      size={16}
                      className="text-gray-400 shrink-0"
                    />
                  </Link>
                ))
              )}
              <div className="flex flex-col items-center gap-2 pt-4 pb-2">
                <Link
                  to={`/professor/alunos/${studentId}/pecas/nova`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#153b50] text-white text-sm font-semibold hover:bg-[#153b50]/90 transition"
                >
                  <MdAdd size={18} />
                  Nova peça
                </Link>
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

          {/* Exercícios */}
          {subTab === "exercises" && (
            <div className="space-y-3">
              {exercises.length === 0 ? (
                <EmptyState
                  title="Nenhum exercício ainda"
                  description="Adicione exercícios técnicos ou teóricos."
                />
              ) : (
                exercises.map((ex) => (
                  <Link
                    key={ex.id}
                    to={`/professor/alunos/${studentId}/exercicios/${ex.id}`}
                    className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#b2f0fb] transition"
                  >
                    <div className="shrink-0">
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
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {ex.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {exerciseCategoryLabel[ex.category] ?? ex.category} ·{" "}
                        {exerciseStatusLabel[ex.status] ?? ex.status}
                      </p>
                    </div>
                    <MdChevronRight
                      size={16}
                      className="text-gray-400 shrink-0"
                    />
                  </Link>
                ))
              )}
              <div className="flex flex-col items-center gap-2 pt-4 pb-2">
                <Link
                  to={`/professor/alunos/${studentId}/exercicios/novo`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#153b50] text-white text-sm font-semibold hover:bg-[#153b50]/90 transition"
                >
                  <MdAdd size={18} />
                  Novo exercício
                </Link>
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
        </div>
      )}

      {/* Tab: Programas */}
      {activeTab === "programs" && (
        <div id="onboarding-teacher-programs" className="space-y-3">
          {programas.length === 0 ? (
            <EmptyState
              title="Nenhum programa ainda"
              description="Crie um programa para começar a gerar o planejamento de estudos do aluno."
            />
          ) : (
            programas.map((prog) => (
              <Link
                key={prog.id}
                to={`/professor/alunos/${studentId}/programas/${prog.id}`}
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#b2f0fb] transition"
              >
                <div className="w-9 h-9 rounded-lg bg-[#153b50] flex items-center justify-center shrink-0">
                  {programIcon(prog.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {prog.title}
                    </p>
                  </div>
                  {prog.deadline && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-400 mt-0.5">
                      <MdCalendarMonth size={11} />
                      {daysUntilLabel(prog.deadline)}
                    </span>
                  )}
                </div>
                <MdChevronRight size={16} className="text-gray-400 shrink-0" />
              </Link>
            ))
          )}
          <Link
            to={`/professor/alunos/${studentId}/programas/novo`}
            className="flex items-center justify-center gap-2 w-full py-24 text-xl font-medium text-gray-300 hover:text-[#153b50] transition"
          >
            <MdAdd size={22} />
            Novo programa
          </Link>
        </div>
      )}

      {/* Tab: Jornada */}
      {activeTab === "journey" && <StudentJornadaTab studentId={studentId!} />}

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
              <h3 className="text-base font-bold text-[#153b50]">
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
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#b2f0fb] focus:ring-2 focus:ring-[#b2f0fb]/20 transition resize-none"
            />
            <button
              onClick={handleImport}
              disabled={importing || !importText.trim()}
              className="w-full py-3 rounded-xl bg-[#153b50] text-white text-sm font-semibold hover:bg-[#153b50]/90 transition disabled:opacity-50"
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
    </TeacherLayout>
  );
}
