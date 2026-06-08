# estudamus — Checklist de Gamificação

> Última atualização: 2026-06-08
> Referência: GAMIFICATION_PLAN.md

---

## Fase 1 — Base de dados

- [ ] **SQL:** Criar tabela `student_xp_events` com RLS e índice
- [ ] **SQL:** Criar tabela `student_achievements` com RLS e índice
- [ ] **SQL:** Salvar script em `docs/schema_gamification.sql`
- [ ] **SQL:** Executar no Supabase (produção + local)
- [ ] Verificar RLS: aluno vê apenas os seus; professor vê dos seus alunos
- [ ] Verificar índices criados: `idx_xp_events_student`, `idx_achievements_student`

---

## Fase 2 — Lógica no frontend

- [ ] Criar `src/lib/xpHelpers.ts`
  - [ ] Função `grantXp(studentId, amount, reason, sourceId, attribute)`
  - [ ] Função `checkAchievements(studentId)` — verifica e insere conquistas novas
  - [ ] Exportar constantes: `REGIONS` (7 entradas), `XP_RULES`, `ACHIEVEMENTS`, `ATTRIBUTE_MAP` (9 atributos)

- [ ] Criar `src/hooks/useStudentProgress.ts`
  - [ ] Query XP total (`SUM student_xp_events`)
  - [ ] Query XP por atributo (`GROUP BY attribute`)
  - [ ] Computar região atual a partir do XP total
  - [ ] Computar streak a partir de `study_sessions` (dias consecutivos)
  - [ ] Computar missões ativas (peças com `completion_pct < 100`)
  - [ ] Computar missão do dia (`plan_items` de hoje com `is_done`)
  - [ ] Computar próximo evento (`programas` com `deadline` mais próximo)
  - [ ] Computar missões semanais (lógica de 3 missões fixas por semana)
  - [ ] Buscar achievements desbloqueados
  - [ ] Retornar tudo como `StudentProgress`

---

## Fase 3 — Gatilhos de XP nas telas existentes

### TodayPage (`src/pages/student/TodayPage.tsx`)
- [ ] Chamar `grantXp(+15, 'checklist_item', planItemId, atributo)` ao marcar item como done
  - [ ] Usar `ATTRIBUTE_MAP[item.category]` para definir o atributo
  - [ ] Só disparar quando `is_done` mudar de `false → true` (não ao desmarcar)
- [ ] Detectar quando todos os itens do dia estão done → `grantXp(+20, 'daily_mission')`
  - [ ] Garantir idempotência: não dar XP de missão diária duas vezes no mesmo dia

### PomodoroPage (`src/pages/student/PomodoroPage.tsx`)
- [ ] Chamar `grantXp(+5, 'pomodoro_session', sessionId, null)` após `INSERT study_sessions`

### RepertoirePage (`src/pages/student/RepertoirePage.tsx`)
- [ ] Após toggle de checklist_completion, buscar `completion_pct` atualizado
- [ ] Se `completion_pct = 100` e era `< 100` antes → `grantXp(+300, 'piece_completed', pieceId, 'musicalidade')`
- [ ] Verificar achievement `first_piece` e `pieces_3` / `pieces_5`

---

## Fase 4 — JourneyPage

- [ ] Criar `src/pages/student/JourneyPage.tsx`
  - [ ] Bloco: saudação com nome do aluno
  - [ ] Bloco: card de região atual (nome, barra de progresso, XP atual/próximo)
  - [ ] Bloco: streak (dias seguidos com ícone de fogo)
  - [ ] Bloco: missão do dia (progresso dos itens de hoje + XP de recompensa)
  - [ ] Bloco: missões ativas (lista de peças/programas ativos com `%`)
  - [ ] Bloco: missões semanais (2–3 missões com status e XP)
  - [ ] Bloco: atributos musicais (barra horizontal por atributo)
  - [ ] Bloco: conquistas (grid de badges — desbloqueadas + próximas bloqueadas)
  - [ ] Estado de loading com `<Spinner />`
  - [ ] Estado vazio se aluno não tem plano ainda

- [ ] Adicionar 4ª aba no `StudentLayout`
  - [ ] Ícone: `MdAutoAwesome` (ou `MdStars`)
  - [ ] Label: "Jornada"
  - [ ] Path: `/aluno/jornada`

- [ ] Adicionar rota em `src/router.tsx`
  - [ ] `<Route path="/aluno/jornada" ... />`

---

## Fase 5 — Feedback visual

- [ ] Toast de XP ao ganhar (sonner com mensagem `+15 XP · Técnica`)
  - [ ] Mostrar toast toda vez que `grantXp` é chamado com sucesso
  - [ ] Usar `toast.success` com mensagem formatada

- [ ] Toast de achievement ao desbloquear
  - [ ] `toast.success('🏅 Conquista: 7 dias seguidos!')`

- [ ] Toast de região ao avançar
  - [ ] Detectar mudança de região no `checkAchievements`
  - [ ] `toast.success('🎉 Nova região: Primeiras Músicas!')`

---

## Verificação final

- [ ] Abrir app como aluno — aba Jornada aparece no bottom nav
- [ ] Marcar item em TodayPage → toast `+15 XP`
- [ ] Completar todos os itens do dia → toast `+20 XP · Missão do dia`
- [ ] Finalizar pomodoro → toast `+5 XP`
- [ ] XP total refletido corretamente na JourneyPage
- [ ] Streak incrementa a cada dia com sessão
- [ ] Peça 100% em RepertoirePage → toast `+300 XP`
- [ ] Build sem erros TypeScript: `npm run build`
- [ ] RLS: aluno A não vê XP do aluno B (testar via Supabase)

---

## Resumo de progresso

| Fase | Itens | Concluídos | % |
|---|---|---|---|
| 1 — Banco de dados | 6 | 0 | 0% |
| 2 — Lógica frontend | 14 | 0 | 0% |
| 3 — Gatilhos de XP | 8 | 0 | 0% |
| 4 — JourneyPage | 14 | 0 | 0% |
| 5 — Feedback visual | 6 | 0 | 0% |
| Verificação final | 9 | 0 | 0% |
| **TOTAL** | **57** | **0** | **0%** |
