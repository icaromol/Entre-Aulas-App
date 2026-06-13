import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";
import {
  Link,
  useSearchParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { MdPerson, MdSchool, MdCheckCircle, MdArrowBack } from "react-icons/md";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type Role = "teacher" | "student";

const ROLES: {
  value: Role;
  label: string;
  features: string[];
  Icon: typeof MdPerson;
}[] = [
  {
    value: "teacher",
    label: "Para dar aulas e estudar",
    features: [
      "Gerenciar alunos e turmas",
      "Criar repertório e exercícios",
      "Planejar estudos dos alunos",
      "Área de estudo pessoal inclusa",
    ],
    Icon: MdSchool,
  },
  {
    value: "student",
    label: "Somente para o meu estudo",
    features: [
      "Organizar seu repertório",
      "Pomodoro e sessões de estudo",
      "Acompanhar seu progresso",
    ],
    Icon: MdPerson,
  },
];


const INSTRUMENTS = [
  "Violão",
  "Guitarra",
  "Baixo",
  "Piano",
  "Teclado",
  "Bateria",
  "Canto",
  "Violino",
  "Viola",
  "Violoncelo",
  "Flauta",
  "Saxofone",
  "Trompete",
  "Percussão",
  "Outro",
];

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inviteStudentId = searchParams.get("invite");
  const inviteToken = searchParams.get("token");
  const autoSignup =
    (location.state as { autoSignup?: boolean } | null)?.autoSignup ??
    searchParams.get("auto") === "1";

  const [inviteStudent, setInviteStudent] = useState<{
    first_name: string;
    last_name: string;
  } | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState(false);

  // Step 1
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  // Step 2 — instrumento(s)
  const [instrument, setInstrument] = useState<string>("");
  const [instruments, setInstruments] = useState<string[]>([]);
    const [step, setStep] = useState<1 | 2>(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!inviteStudentId || !inviteToken) {
      if (inviteStudentId) setInviteInvalid(true);
      return;
    }
    supabase
      .from("students")
      .select("first_name, last_name")
      .eq("id", inviteStudentId)
      .eq("invite_token", inviteToken)
      .is("profile_id", null)
      .gt("invite_expires_at", new Date().toISOString())
      .single()
      .then(({ data }) => {
        if (data) setInviteStudent(data);
        else setInviteInvalid(true);
      });
  }, [inviteStudentId, inviteToken]);

  function toggleTeacherInstrument(inst: string) {
    setInstruments((prev) =>
      prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst],
    );
  }

  function handleRoleSelect(role: Role) {
    setSelectedRole(role);
    setInstrument("");
    setInstruments([]);
    if (!inviteStudentId) setStep(2);
  }

  // Fluxo autoSignup — já autenticado via Google, escolhe role aqui
  async function handleDirectSignup() {
    if (!selectedRole) return;
    setError("");
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate("/login", { replace: true });
      return;
    }

    const user = session.user;
    const googleName = user.user_metadata?.full_name ?? "";
    const firstName =
      user.user_metadata?.given_name || googleName.split(" ")[0] || "";
    const lastName =
      user.user_metadata?.family_name ||
      googleName.split(" ").slice(1).join(" ") ||
      "";

    const { error: rpcErr } = await supabase.rpc("complete_user_profile", {
      p_role: selectedRole,
      p_first_name: firstName,
      p_last_name: lastName,
      p_avatar_url: user.user_metadata?.avatar_url ?? null,
    });

    if (rpcErr) {
      setError("Erro ao criar perfil. Tente novamente.");
      setLoading(false);
      return;
    }

    if (selectedRole === "student") {
      await supabase.from("students").insert({
        profile_id: user.id,
        teacher_id: null,
        first_name: firstName,
        last_name: lastName,
        contact_email: user.email,
        instrument: instrument || null,
        status: "active",
      })
    } else {
      if (instruments.length > 0) {
        await supabase.from("teachers").update({ instruments: instruments.join(", ") }).eq("profile_id", user.id);
      }
    }

    window.location.replace(
      selectedRole === "teacher" ? "/modo" : "/aluno/planejamento",
    );
  }

  // Fluxo normal: OAuth Google — passa instrumento no pending_signup
  async function handleGoogleSignup() {
    if (!inviteStudentId && !selectedRole) return;
    setError("");
    setLoading(true);

    const role: Role = inviteStudentId ? "student" : selectedRole!;
    const pending = inviteStudentId
      ? {
          type: "signup" as const,
          role,
          inviteStudentId,
          inviteToken: inviteToken ?? "",
          firstName: inviteStudent?.first_name,
          lastName: inviteStudent?.last_name,
        }
      : {
          type: "signup" as const,
          role,
          instrument: role === "student" ? instrument : undefined,
          instruments: role === "teacher" ? instruments : undefined,
        };

    sessionStorage.setItem("pending_signup", JSON.stringify(pending));

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError("Não foi possível conectar com o Google. Tente novamente.");
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const subtitle = autoSignup
    ? "Sua conta Google foi conectada. Como quer usar o estudamus?"
    : inviteStudentId
      ? inviteInvalid
        ? "Link de convite inválido ou expirado."
        : inviteStudent
          ? `Olá, ${inviteStudent.first_name}! Crie sua conta para acessar o estudamus.`
          : "Verificando convite..."
      : step === 1
        ? "Como você quer usar a plataforma?"
        : selectedRole === "student" ? "Qual instrumento você toca?" : "Quais instrumentos você ensina?";

  const canProceedStep1 = inviteStudentId
    ? !!inviteStudent && !inviteInvalid
    : !!selectedRole;
  // Instrumento e disponibilidade são opcionais

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <img
            src="/logo_estudamus_vertical_dark_blue.svg"
            alt="estudamus"
            className="w-[150px] mx-auto mb-6"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 pt-7 pb-8 space-y-6">
          {!inviteStudentId && (
            <p className="text-base font-bold text-[#153b50] text-center leading-snug">{subtitle}</p>
          )}
          {inviteStudentId && (
            <p className="text-sm text-gray-500 text-center">{subtitle}</p>
          )}
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          {/* PASSO 1 — Escolha de role */}
          {(step === 1 || autoSignup) && !inviteStudentId && (
            <div className="flex flex-col gap-3">
              {ROLES.map(({ value, label, features, Icon }) => {
                const selected = selectedRole === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      autoSignup
                        ? setSelectedRole(value)
                        : handleRoleSelect(value)
                    }
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 transition text-left ${
                      selected
                        ? "border-[#153b50] bg-[#f5f5f5]"
                        : "border-gray-200 bg-white hover:border-[#b2f0fb]"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? "bg-[#153b50]" : "bg-gray-100"}`}
                    >
                      <Icon
                        size={22}
                        className={selected ? "text-white" : "text-gray-400"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <span
                          className={`text-sm font-bold ${selected ? "text-[#153b50]" : "text-gray-700"}`}
                        >
                          {label}
                        </span>
                      </div>
                      <ul className="space-y-0.5">
                        {features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5">
                            <MdCheckCircle
                              size={12}
                              className={
                                selected ? "text-[#153b50]" : "text-gray-300"
                              }
                            />
                            <span
                              className={`text-xs ${selected ? "text-[#153b50]" : "text-gray-400"}`}
                            >
                              {f}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* PASSO 2 — Instrumento(s) */}
          {step === 2 && !autoSignup && selectedRole && (
            <>
              {selectedRole === "student" ? (
                // Estudante — escolha única
                <div className="grid grid-cols-3 gap-2">
                  {INSTRUMENTS.map((inst) => (
                    <button
                      key={inst}
                      type="button"
                      onClick={() =>
                        setInstrument(inst === instrument ? "" : inst)
                      }
                      className={`py-2 px-1 rounded-xl border text-xs font-medium transition ${
                        instrument === inst
                          ? "bg-[#153b50] text-white border-[#153b50]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-[#b2f0fb]"
                      }`}
                    >
                      {inst}
                    </button>
                  ))}
                </div>
              ) : (
                // Professor — múltipla escolha
                <div className="grid grid-cols-3 gap-2">
                  {INSTRUMENTS.map((inst) => {
                    const sel = instruments.includes(inst);
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => toggleTeacherInstrument(inst)}
                        className={`py-2 px-1 rounded-xl border text-xs font-medium transition ${
                          sel
                            ? "bg-[#153b50] text-white border-[#153b50]"
                            : "bg-white text-gray-600 border-gray-200 hover:border-[#b2f0fb]"
                        }`}
                      >
                        {inst}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Botão de ação */}
          {inviteStudentId && !inviteStudent ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : autoSignup ? (
            <Button onClick={handleDirectSignup} disabled={loading || !canProceedStep1}
              className="w-full h-11 rounded-xl bg-[#153b50] hover:bg-[#153b50]/90 text-white disabled:opacity-40">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : "Continuar"}
            </Button>
          ) : step === 1 ? (
            inviteStudentId && (
              <Button onClick={handleGoogleSignup} disabled={loading || !canProceedStep1} variant="outline"
                className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border-gray-200 text-gray-700 hover:border-[#b2f0fb] hover:bg-gray-50 transition disabled:opacity-40">
                {loading ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <FcGoogle size={20} />}
                {loading ? "Redirecionando..." : "Continuar com Google"}
              </Button>
            )
          ) : (
            // Passo 2: botão final Google + voltar
            <div className="flex flex-col gap-2">
              <Button onClick={handleGoogleSignup} disabled={loading} variant="outline"
                className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border-gray-200 text-gray-700 hover:border-[#b2f0fb] hover:bg-gray-50 transition disabled:opacity-40">
                {loading ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <FcGoogle size={20} />}
                {loading ? "Redirecionando..." : "Continuar com Google"}
              </Button>
              <button onClick={() => setStep(1)}
                className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition py-1">
                <MdArrowBack size={13} /> Voltar
              </button>
            </div>
          )}
        </div>

        {!inviteStudentId && !autoSignup && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{" "}
            <Link
              to="/login"
              className="text-[#b2f0fb] font-medium hover:underline"
            >
              Entrar
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
