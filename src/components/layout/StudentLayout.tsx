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
import { AVATAR_COLORS } from "@/lib/colors";

interface StudentLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: "Planejamento", path: "/aluno/planejamento", Icon: MdCalendarToday },
  { label: "Repertório", path: "/aluno/repertorio", Icon: MdLibraryMusic },
  { label: "Objetivos", path: "/aluno/objetivos", Icon: MdFlag },
  { label: "Jornada", path: "/aluno/jornada", Icon: MdStars },
];

export function StudentLayout({ children }: StudentLayoutProps) {
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

  const isTomatoPage = location.pathname.startsWith("/aluno/planejamento");
  const navColor = isTomatoPage ? "#ff4c3e" : "#153b50";

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-20">
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
              <p className="text-sm font-semibold text-[#153b50] truncate">
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
            <MdEdit size={20} className="text-[#292929] shrink-0" />
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
              <MdSchool size={20} className="text-[#292929] shrink-0" />
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
            <MdAccessTime size={20} className="text-[#292929] shrink-0" />
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
            <MdHistory size={20} className="text-[#292929] shrink-0" />
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
                <MdSwapHoriz size={20} className="text-[#292929] shrink-0" />
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
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#ffeceb] transition text-left"
            >
              <MdLogout size={20} className="text-[#ff4c3e] shrink-0" />
              <span className="text-sm font-medium text-[#ff4c3e]">
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
            <h2 className="text-base font-bold text-[#153b50] mb-1">
              Quer sair?
            </h2>
            <p className="text-sm text-gray-400 mb-5">
              Você será desconectado da sua conta.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 rounded-xl bg-[#ff4c3e] text-white text-sm font-medium hover:bg-[#f50c00] transition"
              >
                Sair e fazer logout
              </button>
              <button
                onClick={() => setShowLogout(false)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-[#b2f0fb] transition"
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
            <h2 className="text-base font-bold text-[#153b50] mb-4">
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
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#b2f0fb] transition"
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
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#b2f0fb] transition"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-[#b2f0fb] transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#153b50] text-white text-sm font-medium hover:bg-[#153b50]/90 transition disabled:opacity-50"
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
              <h2 className="text-base font-bold text-[#153b50]">
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
        className="sticky top-0 z-10 transition-colors duration-300"
        style={{
          backgroundColor: navColor,
          borderBottom: `1px solid ${navColor}`,
        }}
      >
        <div className="px-4 h-14 flex items-center justify-center">
          <img
            src="/logo_estudamus_horizontal_dark_blue.svg"
            alt="estudamus"
            className="h-[35px] brightness-0 invert"
          />
        </div>
      </header>

      {/* Conteúdo */}
      <main className="px-4 py-5">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-10 transition-colors duration-300"
        style={{
          backgroundColor: navColor,
          borderTop: `1px solid ${navColor}`,
        }}
      >
        <div className="flex">
          {navItems.map(({ label, path, Icon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
              >
                <Icon
                  size={22}
                  color={active ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
                />
                <span
                  className={`text-[10px] font-medium ${active ? "text-white" : "text-white/50"}`}
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
            <MdMenu
              size={22}
              color={showMenu ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
            />
            <span
              className={`text-[10px] font-medium ${showMenu ? "text-white" : "text-white/50"}`}
            >
              Menu
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
