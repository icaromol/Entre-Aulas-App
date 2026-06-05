# Entre Aulas — Contexto do Projeto

## O que é

Plataforma web responsiva de gestão pedagógica musical. Dois perfis:
- **Professor**: gerencia alunos, repertório, exercícios, plano semanal, metas e concertos
- **Aluno**: vê o plano do dia, usa o pomodoro, marca o que foi feito

## Stack

```
React 18 + Vite + TypeScript
Tailwind CSS v4
shadcn/ui (preset: radix-nova)
Supabase (Auth + PostgreSQL + RLS)
@dnd-kit/core + @dnd-kit/sortable
react-router-dom v6
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

## Estrutura de Pastas

```
src/
  components/
    auth/AuthGuard.tsx          → protege rotas por role
    layout/TeacherLayout.tsx    → header + nav professor
    layout/StudentLayout.tsx    → header + bottom nav aluno
    ui/button.tsx               → shadcn button
  hooks/useAuth.ts              → { user, profile, loading, signOut }
  lib/
    supabase.ts                 → cliente Supabase
    defaultChecklist.ts         → checklist padrão de peças (15 itens)
    weekUtils.ts                → getMonday, formatWeekStart, addWeeks, formatWeekLabel, getDayLabel, getDayFullLabel, getTodayDayOfWeek
  pages/
    auth/LoginPage, RegisterPage
    teacher/StudentsPage, NewStudentPage, StudentProfilePage, EditStudentPage
    teacher/NewPiecePage, PieceDetailPage, NewExercisePage, WeeklyPlanPage
    student/TodayPage
  types/plan.ts                 → PlanItem, WeeklyPlan
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
goals             → metas com vínculo opcional a checklist_item ou exercise
weekly_plans      → week_start sempre segunda-feira (YYYY-MM-DD)
plan_items        → day_of_week, duration_minutes, is_done, position
study_sessions    → sessões pomodoro com ciclo, duração
session_items     → itens trabalhados por sessão
concerts          → eventos de performance
comments          → linha do tempo por peça/exercício/sessão
```

**RLS em todas as 18 tabelas.** Funções auxiliares: `fn_my_teacher_id()`, `fn_my_student_id()`, `fn_is_my_student()`.

## Rotas

```
/login, /cadastro(?invite=STUDENT_ID)

Professor:
/professor/alunos
/professor/alunos/novo
/professor/alunos/:studentId
/professor/alunos/:studentId/editar
/professor/alunos/:studentId/pecas/nova
/professor/alunos/:studentId/pecas/:pieceId
/professor/alunos/:studentId/exercicios/novo
/professor/alunos/:studentId/plano

Aluno:
/aluno/hoje
/aluno/pomodoro        ← ainda não implementado
/aluno/repertorio      ← ainda não implementado
/aluno/metas           ← ainda não implementado
/aluno/historico       ← ainda não implementado
```

## Padrões de Código

### Queries Supabase
```ts
const { data } = await supabase.from('table').select('*')
setItems(data ?? [])  // sempre fallback

const { data: item } = await supabase.from('table').select().eq('id', id).single()
if (!item) return
```

### Hooks — regra crítica
Todos os `useState` **antes** de qualquer `return` condicional. Nunca condicionar hooks.

### Loading state
```ts
if (loading) return <TeacherLayout><p className="text-sm text-gray-400">Carregando...</p></TeacherLayout>
```

### Formulários
- Sempre `onSubmit={handleSubmit}` com `e.preventDefault()`
- Estado `loading` para desabilitar botão durante submit
- Estado `error` para mensagens inline

### Salvamento de plan_items
Estratégia: DELETE todos do plano + INSERT com posições atualizadas. Simples, sem conflitos.

## O que está implementado (checklist resumida)

**Pronto:**
- Autenticação completa (login, cadastro, convite por link, roles)
- Layouts professor e aluno
- CRUD de alunos com disponibilidade semanal
- Peças com checklist editável e completion_pct automático
- Exercícios (criação, checklist padrão)
- Plano semanal com drag-and-drop (@dnd-kit)
- Página "Hoje" do aluno com progresso e marcar itens

**Falta:**
- Tela do pomodoro com cronômetro
- Detalhe/edição/exclusão de exercício
- Metas
- Concertos/recitais
- Histórico de sessões
- Repertório completo do aluno (bottom nav)
- Toast notifications, empty states com ilustração, página 404
- Deploy (Vercel)

## Variáveis de Ambiente

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Links

- GitHub: https://github.com/icaromol/Entre-Aulas-App
- Supabase: https://supabase.com/dashboard/project/gdyvazyqisigvbhnsxui
