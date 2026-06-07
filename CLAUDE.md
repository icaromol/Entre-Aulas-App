# estudamus — Contexto do Projeto

## O que é

Plataforma web responsiva de gestão pedagógica musical. Dois perfis:
- **Professor**: gerencia alunos, repertório, exercícios, programas e planejamento de estudos
- **Aluno**: vê as tarefas do dia, usa o pomodoro, consulta repertório e histórico

## Stack

```
React 18 + Vite + TypeScript
Tailwind CSS v4
shadcn/ui (preset: radix-nova)
Supabase (Auth + PostgreSQL + RLS)
react-router-dom v6
sonner (toasts)
boring-avatars (beam=aluno, marble=peça, pixel=exercício)
```

## Design System

Paleta fixa — não usar outras cores além dessas:

| Papel | Hex |
|---|---|
| Primária (botões, títulos, destaques) | `#1E3A5F` |
| Secundária (links, elementos ativos) | `#4A90C4` |
| Background de seções | `#D6E4F0` |
| Fundo de cards | `#F5F7FA` |

Arredondamento padrão: `rounded-2xl` em cards, `rounded-xl` em itens internos.
Fonte de destaque: bold azul `#1E3A5F`. Labels secundários: `text-xs text-gray-400`.
`AVATAR_COLORS = ['#1E3A5F','#4A90C4','#D6E4F0','#F5F7FA','#FFFFFF']`

## Estrutura de Pastas

```
src/
  components/
    auth/AuthGuard.tsx          → protege rotas por role
    layout/TeacherLayout.tsx    → header + nav professor
    layout/StudentLayout.tsx    → header + bottom nav aluno (3 abas: Hoje/Repertório/Histórico)
    ui/button.tsx               → shadcn button
  hooks/useAuth.ts              → { user, profile, loading, signOut }
  lib/
    supabase.ts                 → cliente Supabase
    defaultChecklist.ts         → checklist padrão de peças (15 itens)
    weekUtils.ts                → getMonday, formatWeekStart, addWeeks, formatWeekLabel,
                                   getDayLabel, getDayFullLabel, getTodayDayOfWeek, getDayDate
    planGenerator.ts            → algoritmo de geração de planejamento (puro, sem Supabase)
  pages/
    auth/LoginPage, RegisterPage
    teacher/StudentsPage, NewStudentPage, StudentProfilePage, EditStudentPage
    teacher/NewPiecePage, PieceDetailPage, EditPiecePage
    teacher/NewExercisePage, ExerciseDetailPage, EditExercisePage
    teacher/NewProgramaPage, ProgramaDetailPage, EditProgramaPage
    teacher/PlanejamentoPage
    student/TodayPage, PomodoroPage, RepertoirePage, HistoryPage
    NotFoundPage
  types/
    plan.ts      → PlanItem (com checklist_item_id, program_id, is_maintenance), WeeklyPlan
    programs.ts  → Programa, ProgramaType, ProgramaStatus, ProgramPiece, ProgramExercise
  router.tsx
```

## Banco de Dados — Tabelas Principais

```
profiles          → usuários (id, first_name, last_name, role: teacher|student)
teachers          → criado automaticamente por trigger quando role=teacher
students          → aluno, ligado a teacher_id e profile_id (nullable até convite ser aceito)
student_availability → day_of_week(0-6), is_active, minutes_available
pieces            → completion_pct calculado por trigger (INSERT/DELETE em checklist_completions)
checklist_items   → piece_id OU exercise_id, is_optional
checklist_completions → toggle: INSERT para marcar, DELETE para desmarcar
exercises         → categoria: technique|ear_training|harmony|history|improvisation|other
programas         → substitui concerts; type: regular|recital|concerto|show|gravacao|exame|participacao|outro
                    type='regular' inclui todo o repertório ativo automaticamente
program_pieces    → peças vinculadas a um programa (com priority_override)
program_exercises → exercícios vinculados a um programa (com priority_override)
plan_programs     → programas incluídos num planejamento (com weight %)
weekly_plans      → week_start sempre segunda-feira (YYYY-MM-DD), student_id
plan_items        → plan_id(FK weekly_plans), day_of_week, duration_minutes, is_done, position,
                    checklist_item_id(FK), program_id(FK), piece_id(FK, para manutenção),
                    is_maintenance(bool)
study_sessions    → sessões pomodoro: student_id, cycle_name, duration_seconds, difficulty_felt, notes
session_items     → itens trabalhados por sessão (plan_item_id FK)
comments          → linha do tempo por peça/exercício/sessão (não implementado no app ainda)
```

**RLS em todas as tabelas.** Funções auxiliares: `fn_my_teacher_id()`, `fn_my_student_id()`, `fn_is_my_student()`.

## Rotas

```
/login, /cadastro(?invite=STUDENT_ID)
/* → NotFoundPage (404)

Professor:
/professor/alunos
/professor/alunos/novo
/professor/alunos/:studentId                          (tabs: Peças | Exercícios | Programas)
/professor/alunos/:studentId/editar
/professor/alunos/:studentId/pecas/nova
/professor/alunos/:studentId/pecas/:pieceId
/professor/alunos/:studentId/pecas/:pieceId/editar
/professor/alunos/:studentId/exercicios/novo
/professor/alunos/:studentId/exercicios/:exerciseId
/professor/alunos/:studentId/exercicios/:exerciseId/editar
/professor/alunos/:studentId/programas/novo
/professor/alunos/:studentId/programas/:programId
/professor/alunos/:studentId/programas/:programId/editar
/professor/alunos/:studentId/planejamento

Aluno:
/aluno/hoje
/aluno/pomodoro
/aluno/repertorio
/aluno/historico
```

## Padrões de Código

### Queries Supabase
```ts
const { data } = await supabase.from('table').select('*')
setItems(data ?? [])  // sempre fallback

const { data: item } = await supabase.from('table').select().eq('id', id).single()
if (!item) return
```

Joins Supabase retornam arrays para relações FK — fazer cast:
```ts
setItems((res.data ?? []) as unknown as MyType[])
```

### Hooks — regra crítica
Todos os `useState` **antes** de qualquer `return` condicional. Nunca condicionar hooks.

### Loading state
```ts
if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>
```

### Formulários
- Sempre `onSubmit={handleSubmit}` com `e.preventDefault()`
- Estado `saving` para desabilitar botão durante submit
- Estado `error` para mensagens inline

### Salvamento de plan_items
Estratégia: DELETE todos do plano + INSERT com posições atualizadas. Sem conflitos.
A FK de plan_items para weekly_plans se chama `plan_id` (não `weekly_plan_id`).

## O que está implementado ✅

**Autenticação & estrutura**
- Login, cadastro, convite por link (`/cadastro?invite=STUDENT_ID`), roles, logout
- Layouts TeacherLayout e StudentLayout com nav completo
- AuthGuard por role, página 404
- Toast notifications (sonner) em todas as ações de escrita
- Deploy no Vercel

**Professor — Alunos**
- Lista de alunos com avatar (boring-avatars beam)
- CRUD completo: criar, editar (dados + disponibilidade semanal), excluir
- Perfil do aluno com 3 abas: Peças / Exercícios / Programas

**Professor — Peças**
- CRUD completo: criar, detalhe, editar, excluir
- Checklist interativo (adicionar/remover itens, toggle de opcional)
- `completion_pct` calculado automaticamente por trigger no Supabase
- Avatar marble, anel de progresso SVG, badge de status e período

**Professor — Exercícios**
- CRUD completo: criar, detalhe, editar, excluir
- Checklist padrão (15 itens por categoria), toggle de itens
- Avatar pixel, badge de categoria

**Professor — Programas**
- CRUD completo: criar, detalhe, editar (sem excluir — só arquivar via status)
- 8 tipos: regular📚 recital🎭 concerto🎹 show🎤 gravacao🎙️ exame📋 participacao🎵 outro📁
- `regular` inclui todo o repertório ativo automaticamente
- Outros tipos: picker de peças e exercícios para vincular (com progress ring)
- Countdown de prazo colorido (vermelho <14d, âmbar <30d)
- Botão "Gerar Planejamento" navega para PlanejamentoPage

**Professor — Planejamento de Estudos**
- Seleção de programas com pesos (%, soma = 100, botão auto-balancear)
- Horizonte: semana / quinzena / mês
- Toggle de revisão (itens já concluídos entram com score×0.5)
- Toggle de manutenção + slider de budget (10–40%)
- Preview agrupado por semana com stats (tarefas, semanas, minutos)
- Aviso de itens não incluídos (overflow)
- Salva em `weekly_plans` + `plan_items`

**Algoritmo `planGenerator.ts`**
- Priority score: `0.5×difficulty + 0.5×(1−completion%) + urgency_bonus`
- Urgency bonus por prazo: <7d=+0.40 / 7–14d=+0.30 / 15–30d=+0.20 / 31–60d=+0.10
- Modificadores: `is_optional×0.30`, `isRevision×0.50`
- Frequência: `max(1, round(score×3))` capped nos dias ativos
- Round-robin entre dias com capacidade mínima de 5min/tarefa
- Manutenção: pool ordenado por `lastMaintenanceOn ASC` (null=primeiro), tempo proporcional à dificuldade

**Aluno — Hoje**
- Tarefas do dia com título (checklist_item), subtítulo (peça/exercício), badge do programa
- Ícones: 🎵 peça / 🎯 exercício / 🔄 manutenção
- Checkbox de conclusão (atualiza `is_done` em plan_items)
- Barra de progresso (done/total)
- Navegação por dia (chevrons)
- Botão "Começar estudo!" → Pomodoro com contexto da tarefa
- Banner de início rápido

**Aluno — Pomodoro**
- Cronômetro com ciclos (Clássico 25/5, Longo 50/10, Curto 15/5, Livre)
- Pausar/retomar, pular fase
- Tela de conclusão com checklist de itens e avaliação de dificuldade (easy/ok/hard)
- Salva `study_sessions` + `session_items` no Supabase
- `autoStart` para início rápido via TodayPage

**Aluno — Repertório**
- Tabs Peças / Exercícios
- Peças: avatar marble + anel de progresso + checklist expandível (read-only com completions)
- Exercícios: avatar pixel + categoria + status

**Aluno — Histórico**
- Sessões agrupadas por semana
- Destaque "Esta semana" com total de minutos
- Por sessão: data, ciclo, duração, badge de dificuldade, itens trabalhados, notas

## O que falta ❌

**Limpeza de código**
- Arquivos órfãos (não referenciados no router): `NewGoalPage.tsx`, `EditGoalPage.tsx` (teacher)
- HistoryPage: join `session_items → plan_items → exercises` quebrado (exercise_id foi dropado);
  títulos de exercícios não aparecem no histórico (graceful — só não exibe o badge)

**Funcionalidades futuras**
- Excluir / arquivar programa (ProgramaDetailPage só tem botão de arquivar via status, sem DELETE real)
- Histórico de manutenção real (hoje derivado de plan_items, mas sem persistência explícita)
- Algoritmo adaptativo (Fase 8): ajustar pesos futuros com base em `study_sessions`
- Comentários / linha do tempo por peça/exercício (tabela `comments` existe mas sem UI)
- Empty states com ilustração (atualmente só emoji + texto)
- Notificações push / lembretes de estudo

## Variáveis de Ambiente

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Links

- GitHub: https://github.com/icaromol/Entre-Aulas-App
- Supabase: https://supabase.com/dashboard/project/gdyvazyqisigvbhnsxui
- Deploy: https://entre-aulas-app.vercel.app (ou URL configurada no Vercel)
