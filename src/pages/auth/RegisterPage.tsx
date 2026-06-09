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

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const AVAIL_MIN = 5
const AVAIL_MAX = 720
function toSliderPos(m: number) { return Math.round(Math.log(m / AVAIL_MIN) / Math.log(AVAIL_MAX / AVAIL_MIN) * 100) }
function fromSliderPos(p: number) { return Math.max(AVAIL_MIN, Math.round(AVAIL_MIN * Math.pow(AVAIL_MAX / AVAIL_MIN, p / 100) / 5) * 5) }
function fmtMin(m: number) { if (m < 60) return `${m}min`; const h = Math.floor(m / 60), r = m % 60; return r === 0 ? `${h}h` : `${h}h${r}min` }
interface DayAvail { day: number; active: boolean; minutes: number }
const DEFAULT_AVAIL = (): DayAvail[] => DAYS.map((_, i) => ({ day: i, active: false, minutes: 30 }))

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
  // Step 3 — disponibilidade semanal
  const [availability, setAvailability] = useState<DayAvail[]>(DEFAULT_AVAIL());
  const [step, setStep] = useState<1 | 2 | 3>(1);

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

  function toggleDay(i: number) {
    setAvailability(prev => prev.map(d => d.day === i ? { ...d, active: !d.active } : d))
  }

  function setDayMinutes(i: number, minutes: number) {
    setAvailability(prev => prev.map(d => d.day === i ? { ...d, minutes } : d))
  }

  function handleRoleSelect(role: Role) {
    setSelectedRole(role);
    setInstrument("");
    setInstruments([]);
    setAvailability(DEFAULT_AVAIL());
    if (!inviteStudentId) setStep(2);
  }

  async function saveAvailability(studentId: string) {
    const activeDays = availability.filter(d => d.active)
    if (activeDays.length === 0) return
    await supabase.from("student_availability").delete().eq("student_id", studentId)
    await supabase.from("student_availability").insert(
      activeDays.map(d => ({ student_id: studentId, day_of_week: d.day, is_active: true, minutes_available: d.minutes }))
    )
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
      const { data: newStudent } = await supabase.from("students").insert({
        profile_id: user.id,
        teacher_id: null,
        first_name: firstName,
        last_name: lastName,
        contact_email: user.email,
        instrument: instrument || null,
        status: "active",
      }).select("id").single();
      if (newStudent) await saveAvailability(newStudent.id);
    } else {
      if (instruments.length > 0) {
        await supabase.from("teachers").update({ instruments: instruments.join(", ") }).eq("profile_id", user.id);
      }
      // Busca o students row do professor para salvar disponibilidade
      const { data: profStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).maybeSingle();
      if (profStudent) await saveAvailability(profStudent.id);
    }

    window.location.replace(
      selectedRole === "teacher" ? "/modo" : "/aluno/hoje",
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
          availability: availability.filter(d => d.active).map(d => ({ day: d.day, minutes: d.minutes })),
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
        : step === 2
          ? selectedRole === "student" ? "Qual instrumento você toca?" : "Quais instrumentos você ensina?"
          : "Seus dias de estudo";

  const canProceedStep1 = inviteStudentId
    ? !!inviteStudent && !inviteInvalid
    : !!selectedRole;
  // Instrumento e disponibilidade são opcionais

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-24">
          <img
            src="/estudamus_logo.png"
            alt="estudamus"
            className="h-10 mx-auto"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 pt-7 pb-8 space-y-6">
          {!inviteStudentId && (
            <p className="text-base font-bold text-[#1E3A5F] text-center leading-snug">{subtitle}</p>
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
                        ? "border-[#1E3A5F] bg-[#D6E4F0]"
                        : "border-gray-200 bg-white hover:border-[#4A90C4]"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? "bg-[#1E3A5F]" : "bg-gray-100"}`}
                    >
                      <Icon
                        size={22}
                        className={selected ? "text-white" : "text-gray-400"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <span
                          className={`text-sm font-bold ${selected ? "text-[#1E3A5F]" : "text-gray-700"}`}
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
                                selected ? "text-[#1E3A5F]" : "text-gray-300"
                              }
                            />
                            <span
                              className={`text-xs ${selected ? "text-[#1E3A5F]" : "text-gray-400"}`}
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
                          ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]"
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
                            ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                            : "bg-white text-gray-600 border-gray-200 hover:border-[#4A90C4]"
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

          {/* PASSO 3 — Disponibilidade semanal */}
          {step === 3 && !autoSignup && selectedRole && (
            <div className="space-y-2">
              {availability.map(day => (
                <div key={day.day} className="flex items-center gap-3">
                  <button type="button" onClick={() => toggleDay(day.day)}
                    className={`w-12 text-xs font-semibold py-1.5 rounded-lg border transition shrink-0 ${
                      day.active ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-400 border-gray-200 hover:border-[#4A90C4]'
                    }`}>
                    {DAYS[day.day]}
                  </button>
                  {day.active && (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="range" min={0} max={100} step={1}
                        value={toSliderPos(day.minutes)}
                        onChange={e => setDayMinutes(day.day, fromSliderPos(Number(e.target.value)))}
                        className="flex-1 accent-[#1E3A5F]" />
                      <span className="text-xs font-bold text-[#1E3A5F] w-12 text-right shrink-0">
                        {fmtMin(day.minutes)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-400 text-center pt-1">Opcional — pode pular</p>
            </div>
          )}

          {/* Botão de ação */}
          {inviteStudentId && !inviteStudent ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : autoSignup ? (
            <Button onClick={handleDirectSignup} disabled={loading || !canProceedStep1}
              className="w-full h-11 rounded-xl bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white disabled:opacity-40">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : "Continuar"}
            </Button>
          ) : step === 1 ? (
            inviteStudentId && (
              <Button onClick={handleGoogleSignup} disabled={loading || !canProceedStep1} variant="outline"
                className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border-gray-200 text-gray-700 hover:border-[#4A90C4] hover:bg-gray-50 transition disabled:opacity-40">
                {loading ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <FcGoogle size={20} />}
                {loading ? "Redirecionando..." : "Continuar com Google"}
              </Button>
            )
          ) : step === 2 ? (
            // Passo 2 → avança para passo 3
            <div className="flex flex-col gap-2">
              <Button onClick={() => setStep(3)}
                className="w-full h-11 rounded-xl bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white">
                Continuar
              </Button>
              <button onClick={() => setStep(1)}
                className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition py-1">
                <MdArrowBack size={13} /> Voltar
              </button>
            </div>
          ) : (
            // Passo 3: botão final Google + voltar
            <div className="flex flex-col gap-2">
              <Button onClick={handleGoogleSignup} disabled={loading} variant="outline"
                className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border-gray-200 text-gray-700 hover:border-[#4A90C4] hover:bg-gray-50 transition disabled:opacity-40">
                {loading ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <FcGoogle size={20} />}
                {loading ? "Redirecionando..." : "Continuar com Google"}
              </Button>
              <button onClick={() => setStep(2)}
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
              className="text-[#4A90C4] font-medium hover:underline"
            >
              Entrar
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
