import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from 'sonner'
import { MdChevronLeft, MdChevronRight, MdPlayArrow } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from "@/components/layout/StudentLayout";
import { grantXp, EXERCISE_ATTRIBUTE_MAP } from '@/lib/xpHelpers'
import type { XpAttribute } from '@/lib/xpHelpers'
import { fireBasic, fireSideCannons, fireStars, hasRankUp } from '@/lib/confettiEffects'
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

function itemCardClass(item: PlanItem): string {
  if (item.is_maintenance) return "bg-white border-gray-100";
  if (item.exercise_id) return "bg-rose-50 border-rose-100";
  return "bg-[#D6E4F0]/30 border-[#D6E4F0]";
}

const ATTRIBUTE_LABEL: Partial<Record<XpAttribute, string>> = {
  tecnica:       'Técnica',
  leitura:       'Leitura',
  ritmo:         'Ritmo',
  musicalidade:  'Musicalidade',
  performance:   'Performance',
  percepcao:     'Percepção',
  improvisacao:  'Improvisação',
  teoria:        'Teoria',
  historia:      'História',
}

const ACHIEVEMENT_LABEL: Record<string, string> = {
  first_session:        'Primeira sessão concluída',
  first_piece:          'Primeira peça concluída',
  streak_3:             '3 dias seguidos',
  streak_7:             '7 dias seguidos',
  streak_14:            '14 dias seguidos',
  streak_30:            '30 dias seguidos',
  rank_estudante_4:     'Novo rank: Estudante!',
  rank_amador_4:        'Novo rank: Amador!',
  rank_junior_4:        'Novo rank: Júnior!',
  rank_profissional_4:  'Novo rank: Profissional!',
  rank_expert:          'Novo rank: Expert!',
  rank_mestre:          'Rank máximo: Mestre!',
  first_recital:        'Primeiro recital',
  pieces_3:             '3 peças concluídas',
  pieces_5:             '5 peças concluídas',
}

export default function TodayPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [viewDay, setViewDay] = useState(getTodayDayOfWeek());
  const [pendingItem, setPendingItem] = useState<PlanItem | null>(null);

  const weekStart = formatWeekStart(getMonday(new Date()));

  const monday = getMonday(new Date());
  const viewDate = new Date(monday);
  viewDate.setDate(viewDate.getDate() + (viewDay === 0 ? 6 : viewDay - 1));
  const displayDate = viewDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  useEffect(() => {
    if (profile) fetchDayPlan();
  }, [profile, viewDay]);

  async function fetchDayPlan() {
    setLoading(true);

    if (!studentId) {
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id")
        .eq("profile_id", profile!.id)
        .single();

      if (studentError || !student) {
        console.error('[TodayPage] student fetch failed:', studentError)
        setFetchError('Não foi possível carregar seu perfil. Tente recarregar a página.')
        setLoading(false);
        return;
      }
      setStudentId(student.id);
      await fetchItems(student.id);
    } else {
      await fetchItems(studentId);
    }
  }

  async function fetchItems(sid: string) {
    const { data: plan, error: planError } = await supabase
      .from("weekly_plans")
      .select("id")
      .eq("student_id", sid)
      .eq("week_start", weekStart)
      .single();

    if (planError && planError.code !== 'PGRST116') {
      console.error('[TodayPage] plan fetch failed:', planError)
      setFetchError('Não foi possível carregar o planejamento.')
      setLoading(false);
      return;
    }

    if (!plan) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: planItems, error: itemsError } = await supabase
      .from("plan_items")
      .select(
        `
        id, plan_id, day_of_week, piece_id, exercise_id, program_id,
        duration_minutes, position, is_done, done_at, is_maintenance,
        piece:pieces(title, composer),
        exercise:exercises(title, category),
        programa:programas(title, type)
      `,
      )
      .eq("plan_id", plan.id)
      .eq("day_of_week", viewDay)
      .order("position");

    if (itemsError) {
      console.error('[TodayPage] items fetch failed:', itemsError)
      setFetchError('Não foi possível carregar as tarefas do dia.')
      setLoading(false);
      return;
    }

    setItems((planItems ?? []) as unknown as PlanItem[]);
    setLoading(false);
  }

  async function toggleDone(item: PlanItem) {
    const newDone = !item.is_done
    await supabase
      .from("plan_items")
      .update({ is_done: newDone, done_at: newDone ? new Date().toISOString() : null })
      .eq("id", item.id)

    const updatedItems = items.map(i => i.id === item.id ? { ...i, is_done: newDone } : i)
    setItems(updatedItems)

    if (!newDone || !studentId) return

    // Determina atributo pelo tipo do item
    const category = (item as PlanItem & { exercise?: { category?: string } }).exercise?.category
    const attribute: XpAttribute = category
      ? (EXERCISE_ATTRIBUTE_MAP[category] ?? 'tecnica')
      : 'musicalidade'

    const { newAchievements } = await grantXp(studentId, 'checklist_item', item.id, attribute)

    toast.success(`+15 XP · ${ATTRIBUTE_LABEL[attribute] ?? attribute}`)
    for (const key of newAchievements) {
      toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`)
    }

    if (hasRankUp(newAchievements)) fireStars()
    else fireBasic()

    // Missão do dia: todos os itens de hoje concluídos
    const totalNow = updatedItems.length
    const doneNow  = updatedItems.filter(i => i.is_done).length
    if (totalNow > 0 && doneNow === totalNow) {
      const { newAchievements: mAch } = await grantXp(studentId, 'daily_mission', null, null)
      toast.success('+20 XP · Missão do dia completa! 🎉')
      for (const key of mAch) {
        toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`)
      }
      if (hasRankUp(mAch)) fireStars()
      else fireSideCannons()
    }
  }

  function handleItemClick(item: PlanItem) {
    if (item.is_done) {
      toggleDone(item)
    } else {
      setPendingItem(item)
    }
  }

  const done = items.filter((i) => i.is_done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalMinutes = items.reduce((s, i) => s + (i.duration_minutes ?? 0), 0);

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex justify-center py-12"><Spinner /></div>
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
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">
              Progresso de hoje
            </span>
            <span className="text-xs font-bold text-[#1E3A5F]">
              {done}/{total} itens
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4A90C4] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {totalMinutes} min planejados
          </p>
        </div>
      )}

      {/* Lista de itens */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-10 text-center">
          <p className="text-4xl mb-3">🎵</p>
          <p className="text-sm font-semibold text-gray-700">
            Nenhum item para hoje
          </p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Pode aproveitar! Que tal fazer um estudo extra com o botão abaixo?
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const { title, subtitle, maintenanceIcon } = itemDisplay(item);

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition ${itemCardClass(item)} ${
                  item.is_done ? "opacity-60" : ""
                }`}
              >
                <div className="px-4 py-4 flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleItemClick(item)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
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
                        strokeWidth={3}
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Ícone manutenção */}
                  {maintenanceIcon && (
                    <span className="text-base mt-0.5 shrink-0">🔄</span>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${item.is_done ? "line-through text-gray-400" : "text-gray-800"}`}
                    >
                      {title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {subtitle}
                    </p>
                  </div>

                  {/* Tempo */}
                  {item.duration_minutes && (
                    <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                      {item.duration_minutes} min
                    </span>
                  )}
                </div>

                {/* Botão por item */}
                {!item.is_done && (
                  <div className="px-4 pb-3">
                    <button
                      onClick={() =>
                        navigate("/aluno/pomodoro", {
                          state: {
                            planItemId: item.id,
                            title: subtitle ? `${title} — ${subtitle}` : title,
                            durationMinutes: item.duration_minutes,
                            studentId,
                          },
                        })
                      }
                      className="w-full py-2 rounded-xl bg-[#D6E4F0] text-[#1E3A5F] text-xs font-semibold hover:bg-[#4A90C4] hover:text-white transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MdPlayArrow size={14} />
                      Começar estudo!
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
          <p className="text-xs text-white/60 mt-0.5">
            Modo Clássico · inicia imediatamente
          </p>
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

      {/* Conclusão */}
      {total > 0 && done === total && (
        <div className="mt-5 bg-[#D6E4F0] rounded-2xl p-4 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm font-bold text-[#1E3A5F]">
            Parabéns! Você completou o estudo de hoje.
          </p>
        </div>
      )}

      {/* Modal de confirmação manual */}
      {pendingItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-8 px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <p className="text-sm font-bold text-gray-800 mb-1">Concluir sem pomodoro?</p>
            <p className="text-xs font-medium text-gray-600 mb-1 truncate">
              {pendingItem.exercise?.title ?? pendingItem.piece?.title ?? 'Item'}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Você não fez uma sessão de estudo. Deseja marcar como concluído manualmente?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-[#4A90C4] transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => { toggleDone(pendingItem); setPendingItem(null) }}
                className="flex-1 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#1E3A5F]/90 transition"
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
