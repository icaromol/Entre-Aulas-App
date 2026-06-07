import { useEffect, useState, useRef } from "react";
import {
  useParams,
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  MdArrowBack,
  MdMusicNote,
  MdSchool,
  MdLibraryMusic,
  MdCalendarMonth,
  MdAccessTime,
  MdChevronRight,
  MdAdd,
  MdMic,
  MdFolder,
  MdPiano,
  MdTrendingUp,
  MdEmojiEvents,
  MdGraphicEq,
} from "react-icons/md";
import Avatar from "boring-avatars";
import { supabase } from "@/lib/supabase";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { EmptyState } from "@/components/ui/EmptyState";

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

const AVATAR_COLORS = ["#1E3A5F", "#4A90C4", "#D6E4F0", "#F5F7FA", "#FFFFFF"];

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
  const map: Record<string, React.ReactNode> = {
    regular: <MdSchool size={20} className="text-white" />,
    recital: <MdMusicNote size={20} className="text-white" />,
    concerto: <MdLibraryMusic size={20} className="text-white" />,
    show: <MdMic size={20} className="text-white" />,
    gravacao: <MdMic size={20} className="text-white" />,
    exame: <MdSchool size={20} className="text-white" />,
    participacao: <MdMusicNote size={20} className="text-white" />,
    outro: <MdFolder size={20} className="text-white" />,
  };
  return map[type] ?? <MdLibraryMusic size={20} className="text-white" />;
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

type TabKey = "pieces" | "exercises" | "programs";

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
  const initialTab = (searchParams.get("tab") as TabKey) ?? "pieces";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

    setStudent(studentRes.data);
    setAvailability(availRes.data ?? []);
    setPieces(piecesRes.data ?? []);
    setExercises(exercisesRes.data ?? []);
    setProgramas(programasRes.data ?? []);
    setLoading(false);
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

  if (loading) {
    return (
      <TeacherLayout>
        <p className="text-sm text-gray-400">Carregando...</p>
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
              <h2 className="text-base font-bold text-[#1E3A5F]">
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
                className="flex-1 px-3 py-2 rounded-lg border border-[#4A90C4]/30 bg-white text-xs text-gray-600 outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/cadastro?invite=${studentId}`,
                  );
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 2000);
                }}
                className="px-4 py-2 rounded-lg bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#1E3A5F]/90 transition whitespace-nowrap"
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
              <h2 className="text-base font-bold text-[#1E3A5F]">
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
                      <span className="text-xs text-[#4A90C4] font-medium">
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
              className="mt-5 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition"
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
          <h1 className="text-xl font-bold text-[#1E3A5F]">
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

      {/* Banner: Gerar planejamento */}
      <button
        onClick={() => navigate(`/professor/alunos/${studentId}/planejamento`)}
        className="w-full mb-5 bg-[#4A90C4] hover:bg-[#4A90C4]/90 rounded-2xl px-5 py-4 flex items-center justify-between transition group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <MdCalendarMonth size={22} className="text-white" />
          </div>
          <div className="text-left">
            <p className="text-white font-bold text-sm">
              Gerar planejamento de estudos
            </p>
            <p className="text-white/70 text-xs mt-0.5">
              Plano semanal personalizado para {student.first_name}
            </p>
          </div>
        </div>
        <MdChevronRight
          size={20}
          className="text-white/60 group-hover:text-white transition"
        />
      </button>

      {/* Disponibilidade — 7 dias */}
      <div className="flex gap-2 mb-5">
        {[
          { label: "SEG", dow: 1 },
          { label: "TER", dow: 2 },
          { label: "QUA", dow: 3 },
          { label: "QUI", dow: 4 },
          { label: "SEX", dow: 5 },
          { label: "SÁB", dow: 6 },
          { label: "DOM", dow: 0 },
        ].map(({ label, dow }) => {
          const day = availability.find((d) => d.day_of_week === dow);
          const active = day?.is_active ?? false;
          return (
            <div
              key={dow}
              className={`flex-1 rounded-lg border py-2.5 flex flex-col items-center justify-center gap-1 ${
                active
                  ? "bg-[#D6E4F0] border-[#4A90C4]/30"
                  : "bg-gray-100 border-gray-100"
              }`}
            >
              <span
                className={`text-[10px] font-medium leading-none ${active ? "text-[#1E3A5F]" : "text-gray-400"}`}
              >
                {label}
              </span>
              <span
                className={`text-[9px] leading-none ${active ? "text-[#4A90C4]" : "text-gray-300"}`}
              >
                {active ? `${day!.minutes_available}m` : "·"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {(
          [
            { key: "pieces", label: "Peças", Icon: MdMusicNote },
            { key: "exercises", label: "Exercícios", Icon: MdSchool },
            { key: "programs", label: "Programas", Icon: MdLibraryMusic },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === tab.key
                ? "bg-white text-[#1E3A5F] shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <tab.Icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Peças */}
      {activeTab === "pieces" && (
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
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#4A90C4] transition"
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
                      stroke="#4A90C4"
                      strokeWidth="3"
                      strokeDasharray={`${(piece.completion_pct / 100) * 94.2} 94.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full overflow-hidden">
                      <Avatar
                        size={24}
                        name={piece.title}
                        variant="marble"
                        colors={AVATAR_COLORS}
                      />
                    </div>
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
                <MdChevronRight size={16} className="text-gray-400 shrink-0" />
              </Link>
            ))
          )}
          <Link
            to={`/professor/alunos/${studentId}/pecas/nova`}
            className="flex items-center justify-center gap-2 w-full py-24 text-xl font-medium text-gray-300 hover:text-[#1E3A5F] transition"
          >
            <MdAdd size={22} />
            Nova peça
          </Link>
        </div>
      )}

      {/* Tab: Exercícios */}
      {activeTab === "exercises" && (
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
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#4A90C4] transition"
              >
                <div className="shrink-0 rounded-lg overflow-hidden">
                  <Avatar
                    size={36}
                    name={ex.title}
                    variant="pixel"
                    colors={AVATAR_COLORS}
                  />
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
                <MdChevronRight size={16} className="text-gray-400 shrink-0" />
              </Link>
            ))
          )}
          <Link
            to={`/professor/alunos/${studentId}/exercicios/novo`}
            className="flex items-center justify-center gap-2 w-full py-24 text-xl font-medium text-gray-300 hover:text-[#1E3A5F] transition"
          >
            <MdAdd size={22} />
            Novo exercício
          </Link>
        </div>
      )}

      {/* Tab: Programas */}
      {activeTab === "programs" && (
        <div className="space-y-3">
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
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-[#4A90C4] transition"
              >
                <div className="w-9 h-9 rounded-lg bg-[#1E3A5F] flex items-center justify-center shrink-0">
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
            className="flex items-center justify-center gap-2 w-full py-24 text-xl font-medium text-gray-300 hover:text-[#1E3A5F] transition"
          >
            <MdAdd size={22} />
            Novo programa
          </Link>
        </div>
      )}

      {/* Cards: instrumento + nível */}
      <div className="grid grid-cols-2 gap-3 mt-5 mb-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          {(() => {
            const Icon = instrumentIcon(student.instrument);
            return <Icon size={32} className="mx-auto mb-2 text-[#4A90C4]" />;
          })()}
          <p className="text-sm font-bold text-[#1E3A5F] truncate">
            {student.instrument}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Instrumento</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          {(() => {
            const Icon = levelIcon(student.level);
            return <Icon size={32} className="mx-auto mb-2 text-[#4A90C4]" />;
          })()}
          <p className="text-sm font-bold text-[#1E3A5F]">
            {levelLabel[student.level] ?? student.level}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Nível</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdMusicNote size={16} className="mx-auto mb-1 text-[#4A90C4]" />
          <p className="text-2xl font-bold text-[#1E3A5F]">{pieces.length}</p>
          <p className="text-xs text-gray-400 mt-1">Peças</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdSchool size={16} className="mx-auto mb-1 text-[#4A90C4]" />
          <p className="text-2xl font-bold text-[#1E3A5F]">
            {exercises.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Exercícios</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <MdAccessTime size={16} className="mx-auto mb-1 text-[#4A90C4]" />
          <p className="text-2xl font-bold text-[#1E3A5F]">{totalMinutes}</p>
          <p className="text-xs text-gray-400 mt-1">min/semana</p>
        </div>
      </div>
    </TeacherLayout>
  );
}
