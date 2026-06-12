import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Avatar from "boring-avatars";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  MdCalendarToday,
  MdLibraryMusic,
  MdHistory,
  MdStars,
  MdFlag,
  MdMenu,
  MdClose,
  MdEdit,
  MdSchool,
  MdLogout,
  MdSwapHoriz,
  MdAccessTime,
} from "react-icons/md";
import { OnboardingController } from "@/components/onboarding/OnboardingController";
import { AvailabilityEditor } from "@/components/ui/AvailabilityEditor";
import { TomatoBlob } from "@/components/ui/TomatoBlob";

const AVATAR_COLORS = ["#1E3A5F", "#4A90C4", "#D6E4F0", "#F5F7FA", "#FFFFFF"];

interface StudentLayoutProps {
  children: React.ReactNode;
  studiedMinutes?: number;
  totalMinutes?: number;
}

const navItems = [
  { label: "Planejamento", path: "/aluno/planejamento", Icon: MdCalendarToday },
  { label: "Repertório", path: "/aluno/repertorio", Icon: MdLibraryMusic },
  { label: "Objetivos", path: "/aluno/objetivos", Icon: MdFlag },
  { label: "Jornada", path: "/aluno/jornada", Icon: MdStars },
];

export function StudentLayout({
  children,
  studiedMinutes = 0,
  totalMinutes = 0,
}: StudentLayoutProps) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [showMenu, setShowMenu] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameOverride, setNameOverride] = useState<{
    first: string;
    last: string;
  } | null>(null);

  function openEdit() {
    setEditFirst(nameOverride?.first ?? profile?.first_name ?? "");
    setEditLast(nameOverride?.last ?? profile?.last_name ?? "");
    setShowMenu(false);
    setShowEdit(true);
  }

  async function handleSaveProfile() {
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await supabase.rpc("complete_user_profile", {
      p_role: profile.role,
      p_first_name: editFirst.trim(),
      p_last_name: editLast.trim(),
      p_avatar_url: profile.avatar_url,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar perfil.");
      return;
    }
    setNameOverride({ first: editFirst.trim(), last: editLast.trim() });
    setShowEdit(false);
    toast.success("Perfil atualizado!");
  }

  async function handleSignOut() {
    setShowLogout(false);
    await signOut();
    navigate("/login");
  }

  const displayFirst = nameOverride?.first ?? profile?.first_name ?? "";
  const displayLast = nameOverride?.last ?? profile?.last_name ?? "";
  const fullName = `${displayFirst} ${displayLast}`.trim();
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url;

  const isPlanejamento = location.pathname === "/aluno/planejamento";

  return (
    <div
      className={`bg-gray-50 ${isPlanejamento ? "h-screen flex flex-col overflow-hidden" : "min-h-screen pb-20"}`}
    >
      <OnboardingController role="student" />

      {/* Overlay do menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Bottom sheet menu — sempre no DOM para transição */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl transition-transform duration-300 ease-out ${showMenu ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="px-6 pt-4 pb-8 space-y-1">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowMenu(false)}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <MdClose size={22} />
            </button>
          </div>

          {/* Card de perfil */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-11 h-11 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="rounded-full overflow-hidden shrink-0">
                <Avatar
                  size={44}
                  name={fullName}
                  variant="beam"
                  colors={AVATAR_COLORS}
                />
              </div>
            )}
            <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold text-[#1E3A5F] truncate">
                {fullName || "Aluno"}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Ações */}
          <button
            onClick={openEdit}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition text-left"
          >
            <MdEdit size={20} className="text-[#4A90C4] shrink-0" />
            <span className="text-sm font-medium text-gray-700">
              Editar perfil
            </span>
          </button>

          {/* Meu professor — só para estudantes */}
          {profile?.role === "student" && (
            <button
              onClick={() => {
                setShowMenu(false);
                navigate("/aluno/professor");
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition text-left"
            >
              <MdSchool size={20} className="text-[#4A90C4] shrink-0" />
              <span className="text-sm font-medium text-gray-700">
                Meu professor
              </span>
            </button>
          )}

          {/* Dias disponíveis */}
          <button
            onClick={() => {
              setShowMenu(false);
              setShowAvailability(true);
            }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition text-left"
          >
            <MdAccessTime size={20} className="text-[#4A90C4] shrink-0" />
            <span className="text-sm font-medium text-gray-700">
              Dias disponíveis
            </span>
          </button>

          {/* Histórico */}
          <button
            onClick={() => {
              setShowMenu(false);
              navigate("/aluno/historico");
            }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition text-left"
          >
            <MdHistory size={20} className="text-[#4A90C4] shrink-0" />
            <span className="text-sm font-medium text-gray-700">
              Histórico de sessões
            </span>
          </button>

          {/* Trocar área + Sair */}
          {profile?.role === "teacher" && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowMenu(false);
                  navigate("/professor/alunos");
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition text-left"
              >
                <MdSwapHoriz size={20} className="text-[#4A90C4] shrink-0" />
                <span className="text-sm font-medium text-gray-700">
                  Trocar para a área do professor
                </span>
              </button>
            </div>
          )}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                setShowMenu(false);
                setShowLogout(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 transition text-left"
            >
              <MdLogout size={20} className="text-red-400 shrink-0" />
              <span className="text-sm font-medium text-red-500">
                Sair do app
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal logout */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <h2 className="text-base font-bold text-[#1E3A5F] mb-1">
              Quer sair?
            </h2>
            <p className="text-sm text-gray-400 mb-5">
              Você será desconectado da sua conta.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
              >
                Sair e fazer logout
              </button>
              <button
                onClick={() => setShowLogout(false)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-[#4A90C4] transition"
              >
                Permanecer conectado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar perfil */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <h2 className="text-base font-bold text-[#1E3A5F] mb-4">
              Editar perfil
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-medium">
                  Nome
                </label>
                <input
                  value={editFirst}
                  onChange={(e) => setEditFirst(e.target.value)}
                  maxLength={100}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#4A90C4] transition"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium">
                  Sobrenome
                </label>
                <input
                  value={editLast}
                  onChange={(e) => setEditLast(e.target.value)}
                  maxLength={100}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#4A90C4] transition"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-[#4A90C4] transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#1E3A5F]/90 transition disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal disponibilidade */}
      {showAvailability && profile?.studentId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1E3A5F]">
                Dias disponíveis
              </h2>
              <button
                onClick={() => setShowAvailability(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <MdClose size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <AvailabilityEditor
                studentId={profile.studentId}
                onSaved={() => setShowAvailability(false)}
                alwaysExpanded
              />
            </div>
          </div>
        </div>
      )}

      {/* Header — só logo */}
      <header
        className={`bg-white border-b border-gray-100 z-10 shrink-0 ${isPlanejamento ? "" : "sticky top-0"}`}
      >
        <div className="px-4 h-14 flex items-center justify-center">
          <img src="/estudamus_logo.png" alt="estudamus" className="h-5" />
        </div>
      </header>

      {/* Conteúdo */}
      <main
        className={`px-4 py-3 ${isPlanejamento ? "flex-1 overflow-y-auto pb-24" : ""}`}
      >
        {children}
      </main>

      {isPlanejamento ? (
        /* ── PLANEJAMENTO: bottom é flex item shrink-0, sem fixed ── */
        <div
          className="shrink-0 relative"
          style={{ height: "calc(374px * 0.50 + 110px)", overflow: "visible" }}
        >
          {/* Tomate + relógio — metade inferior entra no nav (bottom negativo) */}
          <div
            className="absolute left-0 right-0 flex justify-center pointer-events-none scale-[0.85] sm:scale-100"
            style={{ bottom: "calc(56px - 374px * 0.50)", zIndex: 2 }}
          >
            {/* SVG relógio */}
            <svg
              width={600}
              height={600}
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                bottom: 0,
                zIndex: 1,
              }}
              overflow="visible"
            >
              {(() => {
                const cx = 300;
                const cy = 440;
                const innerMajor = 251;
                const outerMajor = 275;
                const innerMinor = 260;
                const outerMinor = 268;
                const progress =
                  totalMinutes > 0
                    ? Math.min(studiedMinutes / totalMinutes, 1)
                    : 0;

                const startDeg = 180;
                const endDeg = 180 - progress * 180;
                const startRad = (startDeg * Math.PI) / 180;
                const endRad = (endDeg * Math.PI) / 180;
                const largeArc = progress > 0.5 ? 1 : 0;

                const mid = (innerMajor + outerMajor) / 2;
                const half = (outerMajor - innerMajor) * 0.25;
                const fillOuter = mid + half;
                const fillInner = mid - half;
                const ox1 = cx + fillOuter * Math.cos(startRad);
                const oy1 = cy - fillOuter * Math.sin(startRad);
                const ox2 = cx + fillOuter * Math.cos(endRad);
                const oy2 = cy - fillOuter * Math.sin(endRad);
                const ix1 = cx + fillInner * Math.cos(endRad);
                const iy1 = cy - fillInner * Math.sin(endRad);
                const ix2 = cx + fillInner * Math.cos(startRad);
                const iy2 = cy - fillInner * Math.sin(startRad);
                const fillPath = [
                  `M ${ox1} ${oy1}`,
                  `A ${fillOuter} ${fillOuter} 0 ${largeArc} 1 ${ox2} ${oy2}`,
                  `L ${ix1} ${iy1}`,
                  `A ${fillInner} ${fillInner} 0 ${largeArc} 0 ${ix2} ${iy2}`,
                  `Z`,
                ].join(" ");

                return (
                  <>
                    {progress > 0 && <path d={fillPath} fill="#ff4c3e" />}
                    {Array.from({ length: 61 }).map((_, i) => {
                      const angleDeg = 180 - i * 3;
                      const angleRad = (angleDeg * Math.PI) / 180;
                      const isMajor = i % 5 === 0;
                      const inner = isMajor ? innerMajor : innerMinor;
                      const outer = isMajor ? outerMajor : outerMinor;
                      const x1 = cx + inner * Math.cos(angleRad);
                      const y1 = cy - inner * Math.sin(angleRad);
                      const x2 = cx + outer * Math.cos(angleRad);
                      const y2 = cy - outer * Math.sin(angleRad);
                      return (
                        <line
                          key={i}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#2d2b2b"
                          strokeWidth={isMajor ? 2 : 1}
                          strokeOpacity={isMajor ? 0.55 : 0.28}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </>
                );
              })()}
            </svg>
            <TomatoBlob size="md" />
          </div>

          {/* Nav bar — na base do bottom */}
          <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-10">
            <div className="flex">
              {navItems.map(({ label, path, Icon }) => {
                const active = location.pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
                  >
                    <Icon size={22} color={active ? "#1E3A5F" : "#9CA3AF"} />
                    <span
                      className={`text-[10px] font-medium ${active ? "text-[#1E3A5F]" : "text-gray-400"}`}
                    >
                      {label}
                    </span>
                  </Link>
                );
              })}
              <button
                onClick={() => setShowMenu(true)}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
              >
                <MdMenu size={22} color={showMenu ? "#1E3A5F" : "#9CA3AF"} />
                <span
                  className={`text-[10px] font-medium ${showMenu ? "text-[#1E3A5F]" : "text-gray-400"}`}
                >
                  Menu
                </span>
              </button>
            </div>
          </nav>
        </div>
      ) : (
        /* ── OUTRAS PÁGINAS: nav fixed normal ── */
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-10">
          <div className="flex">
            {navItems.map(({ label, path, Icon }) => {
              const active = location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
                >
                  <Icon size={22} color={active ? "#1E3A5F" : "#9CA3AF"} />
                  <span
                    className={`text-[10px] font-medium ${active ? "text-[#1E3A5F]" : "text-gray-400"}`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={() => setShowMenu(true)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
            >
              <MdMenu size={22} color={showMenu ? "#1E3A5F" : "#9CA3AF"} />
              <span
                className={`text-[10px] font-medium ${showMenu ? "text-[#1E3A5F]" : "text-gray-400"}`}
              >
                Menu
              </span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
