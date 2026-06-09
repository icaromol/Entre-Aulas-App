import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  MdChevronLeft,
  MdChevronRight,
  MdPlayArrow,
  MdDeleteOutline,
  MdCheckCircle,
} from "react-icons/md";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { grantXp, EXERCISE_ATTRIBUTE_MAP, ACHIEVEMENT_LABEL } from "@/lib/xpHelpers";
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
  getDayFullLabel,
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


export default function TodayPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<PlanItem[]>([]);
  const [studiedSecs, setStudiedSecs] = useState<Record<string, number>>({});
  const [freeSessions, setFreeSessions] = useState<
    { id: string; minutes: number; label: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(profile?.studentId ?? null);
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

  const monday    = useMemo(() => getMonday(new Date()), []);
  const weekStart = useMemo(() => formatWeekStart(monday), [monday]);

  const viewDate = new Date(monday);
  viewDate.setDate(viewDate.getDate() + (viewDay === 0 ? 6 : viewDay - 1));
  const displayDate = viewDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  useEffect(() => {
    if (profile) fetchDayPlan();
  }, [profile, viewDay]);

  // Re-fetcha ao voltar para a aba após sair (ex: retorno do pomodoro)
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && profile && studentId) fetchItems(studentId);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [profile, studentId, viewDay]);

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
      // Busca teacher_id para exibir mensagem correta no empty state
      const { data: student } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("id", sid)
        .single();
      setHasTeacher(!!student?.teacher_id);
    }

    await fetchItems(sid);
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
      // Verifica se há algum plano em qualquer semana
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

    // Buscar segundos estudados por plan_item
    const planItemIds = resolvedItems.map((i) => i.id);
    if (planItemIds.length > 0) {
      const { data: sessionRows } = await supabase
        .from("session_items")
        .select("plan_item_id, duration_seconds")
        .in("plan_item_id", planItemIds);

      const secsMap: Record<string, number> = {};
      for (const row of (sessionRows ?? []) as any[]) {
        secsMap[row.plan_item_id] = (secsMap[row.plan_item_id] ?? 0) + (row.duration_seconds ?? 0);
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
      .select("id, cycle_name, duration_seconds, session_items(plan_item_id)")
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
        free.push({
          id: sess.id,
          minutes: mins,
          label: sess.cycle_name ?? "Sessão livre",
        });
      }
    }
    setFreeSessions(free);

    setLoading(false);
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

  function handleItemClick(item: PlanItem) {
    if (item.is_done) {
      toggleDone(item);
    } else if (localStorage.getItem(SKIP_KEY) === "1") {
      toggleDone(item, true);
    } else {
      setSkipConfirm(false);
      setPendingItem(item);
    }
  }

  // Total planejado — só itens do plano, sessões livres não inflam o alvo
  const totalMinutes = items.reduce((s, i) => s + (i.duration_minutes ?? 0), 0);

  // Minutos estudados: plan_items concluídos + sessões livres (bônus)
  const studiedMinutes =
    items
      .filter((i) => i.is_done)
      .reduce((s, i) => s + (i.duration_minutes ?? 0), 0) +
    freeSessions.reduce((s, f) => s + f.minutes, 0);

  const denominator = totalMinutes > 0 ? totalMinutes : studiedMinutes;
  const pct =
    denominator > 0
      ? Math.min(100, Math.round((studiedMinutes / denominator) * 100))
      : 0;

  const total = items.length + freeSessions.length;

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
      {/* Header com navegação de dias */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setViewDay((d) => (d + 6) % 7)}
          className="p-2 rounded-xl hover:bg-gray-100 transition cursor-pointer"
        >
          <MdChevronLeft size={22} className="text-gray-400" />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#1E3A5F]">
            Olá, {profile?.first_name} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {displayDate} · {getDayFullLabel(viewDay)}
          </p>
        </div>
        <button
          onClick={() => setViewDay((d) => (d + 1) % 7)}
          className="p-2 rounded-xl hover:bg-gray-100 transition cursor-pointer"
        >
          <MdChevronRight size={22} className="text-gray-400" />
        </button>
      </div>

      {/* Progresso do dia */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
          {pct >= 100 && (
            <div className="flex items-center gap-2 mb-3">
              <MdCheckCircle size={20} className="text-green-500 shrink-0" />
              <p className="text-sm font-bold text-[#1E3A5F]">
                Você <span className="font-bold">já</span> completou o estudo de
                hoje.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">
              Progresso de hoje
            </span>
            <span className="text-xs font-bold text-[#1E3A5F]">
              {totalMinutes > 0
                ? `${studiedMinutes}/${totalMinutes} min`
                : `${studiedMinutes} min`}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-green-500" : "bg-[#4A90C4]"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Lista de itens */}
      {items.length === 0 && freeSessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-10 text-center">
          <p className="text-4xl mb-3">🎵</p>
          {hasAnyPlan === false ? (
            <>
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
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700">
                Nenhum item para hoje
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Pode aproveitar! Que tal fazer um estudo extra com o botão
                abaixo?
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
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
                  className="absolute inset-y-0 left-0 bg-[#BFDBFE] transition-all duration-500 rounded-2xl"
                  style={{ width: `${itemPct * 100}%` }}
                />
                <div className="relative z-10 px-4 py-3 flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleItemClick(item)}
                    className="hover:opacity-80 transition shrink-0"
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                        item.is_done
                          ? "bg-[#1E3A5F] border-[#1E3A5F]"
                          : "border-gray-300 hover:border-[#4A90C4]"
                      }`}
                    >
                      {item.is_done && (
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
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
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
                      {item.duration_minutes
                        ? `${!maintenanceIcon && subtitle ? " · " : ""}${item.duration_minutes} min`
                        : ""}
                    </p>
                  </div>

                  {/* Botão iniciar */}
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
                      className="shrink-0 flex flex-col items-center justify-center gap-1 px-4 py-2.5 rounded-xl bg-[#D6E4F0] hover:bg-[#4A90C4] text-[#1E3A5F] hover:text-white transition"
                    >
                      <MdPlayArrow size={22} />
                      <span className="text-xs font-bold leading-none">
                        Iniciar
                      </span>
                    </button>
                  )}
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
      <button
        onClick={() =>
          navigate("/aluno/pomodoro", {
            state: {
              title: "Sessão de hoje",
              durationMinutes: totalMinutes || 25,
              studentId,
              autoStart: true,
            },
          })
        }
        className="mt-5 w-full bg-[#1E3A5F] rounded-2xl px-5 py-5 flex items-center justify-center gap-4 hover:bg-[#1E3A5F]/90 transition cursor-pointer"
      >
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <MdPlayArrow size={28} className="text-white ml-1" />
        </div>
        <div className="text-left">
          <p className="text-base font-bold text-white">Início rápido</p>
          <p className="text-xs text-white/60 mt-0.5">20 min · 5 min pausa</p>
        </div>
      </button>

      <div className="flex justify-center mt-6">
        <Button
          variant="text"
          onClick={() => navigate("/aluno/pomodoro", { state: { studentId } })}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          ou clique para uma sessão personalizada
        </Button>
      </div>

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
