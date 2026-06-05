# Entre Aulas — Technical Implementation Brief

> O que foi construído, como foi construído e decisões tomadas no caminho.

---

## Stack

```
React 18 + Vite + TypeScript
Tailwind CSS v4
shadcn/ui (preset: radix-nova)
Supabase (Auth + PostgreSQL + RLS)
@dnd-kit/core + @dnd-kit/sortable (drag and drop)
react-router-dom v6
```

---

## Estrutura de Pastas

```
src/
  components/
    auth/
      AuthGuard.tsx          → protege rotas por role
    layout/
      TeacherLayout.tsx      → header + nav do professor
      StudentLayout.tsx      → header + bottom nav do aluno
    ui/
      button.tsx             → shadcn button
  hooks/
    useAuth.ts               → hook global de autenticação
  lib/
    supabase.ts              → cliente Supabase
    defaultChecklist.ts      → checklist padrão de peças
    weekUtils.ts             → utilitários de semana (getMonday, formatWeekLabel etc.)
  pages/
    auth/
      LoginPage.tsx
      RegisterPage.tsx
    teacher/
      StudentsPage.tsx
      NewStudentPage.tsx
      StudentProfilePage.tsx
      EditStudentPage.tsx
      NewPiecePage.tsx
      PieceDetailPage.tsx
      NewExercisePage.tsx
      WeeklyPlanPage.tsx
    student/
      TodayPage.tsx
  types/
    plan.ts                  → interfaces PlanItem e WeeklyPlan
  router.tsx
  main.tsx
  index.css
```

---

## Autenticação

**Implementado com Supabase Auth.**

### Signup
- `supabase.auth.signUp()` com `raw_user_meta_data`: `first_name`, `last_name`, `role`
- Trigger `trg_on_auth_user_created` → cria `profiles` automaticamente
- Trigger `trg_on_profile_created` → cria `teachers` se `role = teacher`
- Confirmação de e-mail desabilitada no Supabase (ambiente de desenvolvimento)

### Login
- `supabase.auth.signInWithPassword()`
- Após login, busca `profiles.role` e redireciona para `/professor` ou `/aluno`

### Fluxo de convite para aluno
1. Professor cadastra aluno — `profile_id` fica `null` no registro
2. Sistema gera link: `window.location.origin + /cadastro?invite=STUDENT_ID`
3. `RegisterPage` lê `?invite=` da URL, busca dados do aluno, pré-preenche e bloqueia campos
4. Ao criar conta, faz `UPDATE students SET profile_id = user.id WHERE id = inviteStudentId`
5. RLS policy: `"Leitura pública por invite" on students for select using (true)` — permite buscar dados sem autenticação para o fluxo de convite

### `useAuth.ts`
- `supabase.auth.getSession()` na montagem
- `supabase.auth.onAuthStateChange()` para escutar mudanças
- Busca `profiles` e expõe `{ user, profile, loading, signOut }`

### `AuthGuard.tsx`
- Recebe `allowedRole?: 'teacher' | 'student'`
- Enquanto `loading`: exibe spinner
- Sem usuário: redireciona para `/login`
- Role errado: redireciona para a área correta do role

---

## Banco de Dados

### Schema
Arquivo: `praxis_schema.sql` — importado diretamente no SQL Editor do Supabase.

**18 tabelas, 15 enums, 27 indexes, 43 policies RLS, 8 funções, 12 triggers.**

### Correções aplicadas após import

```sql
-- Trigger de profile precisou de search_path explícito
create or replace function fn_handle_new_user()
returns trigger language plpgsql security definer
set search_path = public ...

-- Trigger de teacher criado separadamente (não estava no schema original)
create or replace function fn_handle_new_teacher()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.role = 'teacher' then
    insert into public.teachers (profile_id) values (new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Policy de delete para alunos adicionada após identificar bloqueio de RLS
create policy "Professor exclui os próprios alunos"
  on students for delete
  using (teacher_id = fn_my_teacher_id());

-- Coluna invite_token adicionada após schema inicial
alter table students add column invite_token uuid default uuid_generate_v4();
create unique index idx_students_invite_token on students(invite_token);
```

---

## Módulos Implementados

### Listagem de alunos (`StudentsPage`)
- Query: `supabase.from('students').select(...).eq('status', 'active').order('first_name')`
- Avatar com iniciais gerado com CSS
- Banner de convite após cadastro via `useLocation().state`

### Cadastro de aluno (`NewStudentPage`)
- Validação de e-mail duplicado antes do insert
- Disponibilidade: 7 botões toggle + input de minutos por dia ativo
- Insert em `students` → insert em `student_availability` (7 registros)
- Navega para `/professor/alunos` com `state: { inviteLink, studentName }`

### Edição de aluno (`EditStudentPage`)
- Carrega dados existentes no `useEffect`
- Disponibilidade: delete + reinsert (estratégia simples e segura)

### Perfil do aluno (`StudentProfilePage`)
- `Promise.all` com 4 queries paralelas
- Tabs: Peças / Exercícios / Informações
- Cards de resumo: contagem de peças, exercícios, minutos/semana
- Progresso circular SVG com `strokeDasharray` calculado
- Exclusão com `confirm()` nativo + cascade no banco

### Peças (`NewPiecePage` + `PieceDetailPage`)

**Criação:**
- Insert em `pieces`
- Insert em `checklist_items` com todos os itens de `DEFAULT_CHECKLIST` (`is_default: true`)

**Detalhe:**
- Carrega peça + checklist + completions em paralelo
- `completedIds` como `Set<string>` para lookup O(1)
- Toggle de item: INSERT ou DELETE em `checklist_completions`
- Atualização otimista do `completion_pct` no estado local (sem re-fetch)
- Adicionar item personalizado: insert + append no estado
- Deletar item: delete + filter no estado
- Agrupamento por categoria com `reduce`
- Select de status com save imediato

### Exercícios (`NewExercisePage`)
- Mesma lógica das peças
- Checklist padrão específica para exercícios (5 itens)
- Categorias selecionáveis com grid de botões

### Plano semanal (`WeeklyPlanPage`)

**Estratégia de semana:**
- `getMonday(date)` calcula sempre a segunda-feira da semana atual
- `week_start` como string `YYYY-MM-DD` — chave única `(student_id, week_start)`
- Navegar entre semanas: `addWeeks(date, ±1)`

**Criação do plano:**
- Busca plano existente para `(student_id, week_start)`
- Se não existe: cria automaticamente
- Carrega `plan_items` com join em `pieces` e `exercises`

**Drag and drop com `@dnd-kit`:**
- `DndContext` com `PointerSensor` (activationConstraint: distance 5px)
- `SortableContext` por coluna (dia)
- `handleDragOver`: detecta mudança de dia pelo `overId` ou pelo item sobreposto
- `handleDragEnd`: reordena com `arrayMove` se mesmo dia
- `DragOverlay`: preview do item sendo arrastado
- Colunas renderizadas apenas para dias com `is_active = true`

**Salvar plano:**
- Estratégia: DELETE todos os `plan_items` do plano + INSERT com posições atualizadas
- Simples e sem conflitos de reordenação

**Copiar semana anterior:**
- Busca plano de `week_start - 7 dias`
- Delete itens atuais + insert cópias com `is_done: false`

### Plano do dia — Aluno (`TodayPage`)
- `getTodayDayOfWeek()` — `new Date().getDay()`
- Busca `student_id` pelo `profile_id` do usuário logado
- Busca plano da semana atual + filtra por `day_of_week = today`
- Toggle `is_done` com update direto no banco
- Progresso calculado localmente: `done/total * 100`
- Botão "Iniciar pomodoro" navega para `/aluno/pomodoro` com `state` contendo contexto do item

---

## Componentes de Layout

### `TeacherLayout`
- Header fixo com logo + nav central (Alunos / Agenda)
- Nav mobile como segunda linha abaixo do header
- Links ativos detectados com `location.pathname.startsWith(item.path)`

### `StudentLayout`
- Header simples com nome do aluno e botão de sair
- Bottom navigation fixo com 4 tabs: Hoje / Repertório / Metas / Histórico
- Ícones SVG inline (sem dependência externa)
- `pb-20` no container para não sobrepor o conteúdo

---

## Padrões de Código

### Queries Supabase
```ts
// Sempre tratar erro ou usar dados com fallback
const { data } = await supabase.from('table').select('*')
setItems(data ?? [])

// Para single com possível null
const { data: item } = await supabase.from('table').select('*').eq('id', id).single()
if (!item) return
```

### Estados de loading
```ts
const [loading, setLoading] = useState(true)
// ... fetch
setLoading(false)

if (loading) return <Layout><p>Carregando...</p></Layout>
```

### Hooks — regra crítica
Todos os `useState` devem estar no topo do componente, **antes** de qualquer `return` condicional. Quebrar essa regra causa o erro "Rules of Hooks".

### Formulários
- Sem `<form>` com action — sempre `onSubmit={handleSubmit}` com `e.preventDefault()`
- `loading` state para desabilitar o botão durante o submit
- `error` state para exibir mensagens inline

---

## Problemas Encontrados e Soluções

| Problema | Causa | Solução |
|---|---|---|
| `Database error saving new user` | Trigger sem `set search_path = public` | Recriar função com search_path explícito |
| RLS bloqueando insert em `teachers` | Insert feito antes da sessão estar estabelecida | Mover lógica para trigger no banco |
| `Email not confirmed` | Supabase exige confirmação por padrão | Desativar em Auth → Providers → Email |
| RLS bloqueando delete de aluno | Policy de delete não criada no schema | Criar policy explícita para delete |
| Arquivos shadcn em `@/` na raiz | Alias não estava configurado no momento do `init` | Mover manualmente para `src/` |
| `useState` dentro do `return` | Hook fora do topo do componente | Mover para o topo junto dos outros states |
| Push rejeitado pelo GitHub | Repositório tinha commit inicial | `git push --force` no primeiro push |
