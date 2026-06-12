import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Avatar from "boring-avatars";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  MdMenu,
  MdEdit,
  MdLogout,
  MdEmojiEvents,
  MdSwapHoriz,
} from "react-icons/md";
import { OnboardingController } from "@/components/onboarding/OnboardingController";
import { AVATAR_COLORS } from "@/lib/colors";

interface TeacherLayoutProps {
  children: React.ReactNode;
}

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [showMenu, setShowMenu] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameOverride, setNameOverride] = useState<{
    first: string;
    last: string;
  } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!profile?.teacherId) return;
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", profile.teacherId)
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [profile?.teacherId, location.pathname]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingController role="teacher" />

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
                className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
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

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-14 grid grid-cols-3 items-center">
          {/* Logo — coluna esquerda */}
          <Link to="/professor/jornada" className="flex items-center">
            <img
              src="/estudamus_logo.png"
              alt="estudamus"
              className="h-[22px]"
            />
          </Link>

          {/* Nav central — coluna central */}
          <nav className="hidden sm:flex items-center justify-center gap-6">
            <Link
              to="/professor/jornada"
              className={`text-sm font-medium transition ${
                location.pathname.startsWith("/professor/jornada")
                  ? "text-[#153b50]"
                  : "text-gray-400 hover:text-[#153b50]"
              }`}
            >
              Início
            </Link>
            <Link
              to="/professor/alunos"
              className={`relative text-sm font-medium transition ${
                location.pathname.startsWith("/professor/alunos")
                  ? "text-[#153b50]"
                  : "text-gray-400 hover:text-[#153b50]"
              }`}
            >
              Alunos
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-[#b2f0fb]" />
              )}
            </Link>
          </nav>

          {/* Hamburger menu — coluna direita */}
          <div className="relative flex justify-end">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className={`transition ${showMenu ? "text-[#153b50]" : "text-gray-400 hover:text-[#153b50]"}`}
              aria-label="Menu"
            >
              <MdMenu size={22} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                  {/* Perfil */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={fullName}
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="rounded-full overflow-hidden shrink-0">
                        <Avatar
                          size={36}
                          name={fullName}
                          variant="beam"
                          colors={AVATAR_COLORS}
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#153b50] truncate">
                        {fullName || "Professor"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        navigate("/professor/jornada");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
                    >
                      <MdEmojiEvents
                        size={18}
                        className="text-[#2d2b2b] shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Minha Jornada
                      </span>
                    </button>
                    <button
                      onClick={openEdit}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
                    >
                      <MdEdit size={18} className="text-[#2d2b2b] shrink-0" />
                      <span className="text-sm font-medium text-gray-700 flex-1">
                        Editar perfil
                      </span>
                    </button>
                    <div className="mx-3 border-t border-gray-100" />
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        navigate("/aluno/planejamento");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
                    >
                      <MdSwapHoriz
                        size={18}
                        className="text-[#2d2b2b] shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Trocar para a área de estudante
                      </span>
                    </button>
                    <div className="mx-3 border-t border-gray-100" />
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowLogout(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-50 transition text-left"
                    >
                      <MdLogout size={18} className="text-[#ff4c3e] shrink-0" />
                      <span className="text-sm font-medium text-red-500">
                        Sair
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Nav mobile */}
        <div className="sm:hidden flex gap-5 px-4 border-t border-gray-100">
          <Link
            to="/professor/jornada"
            className={`py-2 text-xs font-medium transition ${
              location.pathname.startsWith("/professor/jornada")
                ? "text-[#153b50] border-b-2 border-[#153b50]"
                : "text-gray-400"
            }`}
          >
            Início
          </Link>
          <Link
            to="/professor/alunos"
            className={`relative py-2 text-xs font-medium transition ${
              location.pathname.startsWith("/professor/alunos")
                ? "text-[#153b50] border-b-2 border-[#153b50]"
                : "text-gray-400"
            }`}
          >
            Alunos
            {pendingCount > 0 && (
              <span className="absolute -top-0 -right-2 w-2 h-2 rounded-full bg-[#b2f0fb]" />
            )}
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}
