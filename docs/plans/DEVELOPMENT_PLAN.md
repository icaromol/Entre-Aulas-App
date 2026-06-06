# Entre Aulas — Plano Completo de Desenvolvimento

> Versão 2.0 — Junho 2025
> Inclui todas as decisões tomadas após o briefing inicial.

---

## Visão Atualizada do Produto

O Entre Aulas é uma plataforma de gestão pedagógica musical com três camadas:

1. **Planos de estudo** — o contexto macro do aluno (recital, manutenção, iniciante)
2. **Plano semanal** — distribuição automática dos itens do plano nos dias da semana
3. **Sessão diária** — o aluno executa, registra e cronometra o estudo

---

## Mudanças em relação ao briefing inicial

### O que mudou no modelo de dados

**Antes:** `students.study_objective` — um campo simples no aluno

**Agora:** Tabela `student_plans` — o aluno pode ter múltiplos planos simultâneos, cada um com título, objetivo, prazo e repertório próprio.

**Motivo:** Um aluno pode estar preparando um recital E mantendo peças antigas ao mesmo tempo. Os planos ficam separados, cada um com suas tarefas.

**Nova categoria de exercício:** `body_awareness` (consciência corporal) — entra em todos os planos com fatia fixa de tempo.

**Nova tabela:** `plan_repertoire` — vincula peças e exercícios a um plano específico.

**Novo campo:** `plan_items.plan_repertoire_id` — rastreia de qual plano veio cada item do plano semanal (alimenta o algoritmo de score).

---

## Modelo de Dados — Adições ao Schema

### Novas tabelas

```sql
-- Planos de estudo do aluno
create table student_plans (
  id           uuid primary key default uuid_generate_v4(),
  student_id   uuid not null references students(id) on delete cascade,
  teacher_id   uuid not null references teachers(id) on delete restrict,
  title        text not null,
  objective    text not null check (objective in (
                 'recital', 'recording', 'maintenance', 'beginner'
               )),
  due_date     date,
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Repertório vinculado a cada plano
create table plan_repertoire (
  id           uuid primary key default uuid_generate_v4(),
  plan_id      uuid not null references student_plans(id) on delete cascade,
  piece_id     uuid references pieces(id) on delete cascade,
  exercise_id  uuid references exercises(id) on delete cascade,
  priority     int2 not null default 0,
  created_at   timestamptz not null default now(),
  constraint chk_plan_repertoire_owner check (
    (piece_id is not null and exercise_id is null) or
    (piece_id is null and exercise_id is not null)
  )
);

-- Templates de distribuição por objetivo
create table study_templates (
  id           uuid primary key default uuid_generate_v4(),
  objective    text not null,
  item_type    text not null,
  label        text not null,
  percentage   int2 not null check (percentage between 0 and 100),
  priority     int2 not null default 0
);
```

### Alterações em tabelas existentes

```sql
-- Adicionar categoria consciência corporal
alter type exercise_category add value 'body_awareness';

-- Rastrear origem do item no plano semanal
alter table plan_items
  add column student_plan_id uuid references student_plans(id) on delete set null,
  add column plan_repertoire_id uuid references plan_repertoire(id) on delete set null;
```

### Dados iniciais dos templates

```sql
-- RECITAL / CD
insert into study_templates (objective, item_type, label, percentage, priority) values
  ('recital', 'body_awareness', 'Consciência corporal',  5, 1),
  ('recital', 'technique',      'Técnica e aquecimento', 10, 2),
  ('recital', 'new_piece',      'Peças do programa',     60, 3),
  ('recital', 'maintenance',    'Polimento e manutenção',20, 4),
  ('recital', 'other',          'Percepção e teoria',    5, 5);

-- MANUTENÇÃO / INTERMEDIÁRIO
insert into study_templates (objective, item_type, label, percentage, priority) values
  ('maintenance', 'body_awareness', 'Consciência corporal',  5, 1),
  ('maintenance', 'technique',      'Técnica e aquecimento', 20, 2),
  ('maintenance', 'new_piece',      'Peças novas',           45, 3),
  ('maintenance', 'maintenance',    'Manutenção',            25, 4),
  ('maintenance', 'other',          'Percepção e teoria',    5, 5);

-- INICIANTE
insert into study_templates (objective, item_type, label, percentage, priority) values
  ('beginner', 'body_awareness', 'Consciência corporal',  10, 1),
  ('beginner', 'technique',      'Técnica e aquecimento', 30, 2),
  ('beginner', 'new_piece',      'Peça em andamento',     50, 3),
  ('beginner', 'other',          'Percepção e teoria',    10, 4);
```

### RLS para novas tabelas

```sql
-- student_plans
alter table student_plans enable row level security;

create policy "Professor gerencia planos dos seus alunos"
  on student_plans for all
  using (teacher_id = fn_my_teacher_id())
  with check (teacher_id = fn_my_teacher_id());

create policy "Aluno vê os próprios planos"
  on student_plans for select
  using (student_id = fn_my_student_id());

-- plan_repertoire
alter table plan_repertoire enable row level security;

create policy "Professor gerencia repertório dos planos"
  on plan_repertoire for all
  using (
    exists (
      select 1 from student_plans sp
      where sp.id = plan_repertoire.plan_id
        and sp.teacher_id = fn_my_teacher_id()
    )
  );

create policy "Aluno vê repertório dos próprios planos"
  on plan_repertoire for select
  using (
    exists (
      select 1 from student_plans sp
      where sp.id = plan_repertoire.plan_id
        and sp.student_id = fn_my_student_id()
    )
  );

-- study_templates (leitura pública)
alter table study_templates enable row level security;

create policy "Leitura pública de templates"
  on study_templates for select
  using (true);
```

---

## Algoritmo de Geração do Plano Semanal

### Visão geral

O algoritmo roda quando o professor clica em "Gerar semana automaticamente". Produz um preview que pode ser aprovado ou ajustado antes de salvar.

### Etapa 1 — Calcular score de cada peça

O score determina a prioridade e frequência da peça nessa semana.

```
SCORE =
  (100 - completion_pct) × 0.5       → menos pronta = mais urgente
  + urgencia_concerto × 0.3          → concerto próximo = mais urgente
  + semanas_sem_aparecer × 0.2       → não apareceu recentemente = sobe na fila

urgencia_concerto:
  → peça vinculada a concerto em ≤ 2 semanas  = 10
  → peça vinculada a concerto em ≤ 4 semanas  = 7
  → peça vinculada a concerto em ≤ 8 semanas  = 4
  → sem concerto vinculado                    = 0

semanas_sem_aparecer:
  → conta quantas semanas desde o último plan_item com essa peça
  → máximo de 4 (não aumenta indefinidamente)
```

### Etapa 2 — Definir frequência por peça

```
completion_pct < 50%    → 5x por semana (quase todo dia)
completion_pct 50–99%   → 3–4x por semana
completion_pct = 100%   → 1–2x por semana (manutenção)

Se concerto em ≤ 2 semanas → sobe uma categoria
```

### Etapa 3 — Selecionar "peça da semana"

A peça com maior score recebe foco especial:
- Aparece em todos os dias disponíveis
- Recebe +20% do tempo alocado para peças

O professor pode trocar a peça do foco no preview.

### Etapa 4 — Distribuir nos dias

Para cada dia ativo (com `is_active = true`):

```
1. Calcula tempo por categoria via template:
   minutos_categoria = total_minutos_dia × (percentual / 100)

2. Aloca itens fixos primeiro:
   → Técnica: exercícios com category = 'technique' do plano
   → Consciência corporal: exercícios com category = 'body_awareness'

3. Aloca peças novas:
   → Pega peças que precisam aparecer nesse dia (por frequência)
   → Ordena por score (maior primeiro)
   → Distribui o tempo proporcionalmente ao score

4. Aloca manutenção (se houver tempo e a peça precisa aparecer):
   → Peças com completion_pct = 100%
   → Distribui nos dias com mais tempo disponível

5. Se sobrar tempo → percepção/harmonia/outros
```

### Etapa 5 — Rotação semanal

Para evitar que a mesma peça entre sempre no mesmo dia:
- Mantém um `rotation_offset` por plano (incrementa a cada semana)
- Desloca o início da lista de peças por esse offset

### Regras extras

- Não repetir o mesmo item duas vezes no mesmo dia
- Se o tempo disponível do dia for < 30 min, só entra técnica + 1 peça
- Peças de manutenção nunca entram em dias de menos de 20 min

---

## Templates de Distribuição

### Recital / Gravar CD

| Categoria | % | Frequência |
|---|---|---|
| Consciência corporal | 5% | Todo dia |
| Técnica | 10% | Todo dia |
| Peças do programa | 60% | 5x/semana (novas) / 2x (manutenção) |
| Polimento e manutenção | 20% | 2x/semana |
| Percepção e teoria | 5% | 1–2x/semana |

### Manutenção / Intermediário

| Categoria | % | Frequência |
|---|---|---|
| Consciência corporal | 5% | Todo dia |
| Técnica | 20% | Todo dia |
| Peças novas | 45% | 4x/semana |
| Manutenção | 25% | 2x/semana |
| Percepção e teoria | 5% | 1x/semana |

### Iniciante

| Categoria | % | Frequência |
|---|---|---|
| Consciência corporal | 10% | Todo dia |
| Técnica | 30% | Todo dia |
| Peça em andamento | 50% | 5x/semana |
| Percepção e teoria | 10% | 2x/semana |

---

## Interfaces a Construir

### Professor

**Tela: Planos do aluno** (`/professor/alunos/:id/planos`)
- Lista de planos ativos e encerrados
- Botão "Novo plano"
- Card por plano: título, objetivo, prazo, nº de peças, barra de progresso geral

**Tela: Detalhe do plano** (`/professor/alunos/:id/planos/:planId`)
- Dados do plano (título, objetivo, prazo)
- Lista de peças vinculadas com % de conclusão
- Lista de exercícios vinculados
- Botão "Adicionar peça/exercício" (busca no repertório existente do aluno)
- Botão "Gerar semana" → abre o gerador

**Modal: Gerador de plano semanal**
- Mostra o preview dia a dia
- Destaque para a "peça da semana"
- Permite trocar a peça do foco
- Botão "Aprovar e salvar" / "Ajustar manualmente"

**Tela: Plano semanal** (já existe — integrar com os planos)
- Mostrar de qual plano veio cada item
- Badge colorido por plano (se tiver múltiplos)

### Aluno

**Tela: Hoje** (já existe — melhorar)
- Mostrar o plano/objetivo do dia
- Agrupar itens por plano se tiver múltiplos
- Badge "Peça da semana" no item em foco

---

## Fluxo Completo Professor → Aluno

```
1. Professor cadastra aluno
2. Professor cria plano (ex: "Recital de Inverno 2025")
   → Define objetivo: recital
   → Define prazo: 15/07/2025
3. Professor vincula peças ao plano
   → 3 peças do programa do recital
   → 1 exercício de técnica
   → 1 exercício de consciência corporal
4. Professor clica "Gerar semana"
   → Sistema calcula scores, frequências, distribui
   → Preview aparece
   → Professor aprova ou ajusta
5. Aluno abre o app → vê o plano do dia
   → Cards com peça, tempo sugerido, botão pomodoro
6. Aluno estuda → registra sessão
   → Score das peças atualiza
   → Histórico alimenta o algoritmo da semana seguinte
7. Professor revisa histórico antes da próxima aula
   → Vê o que o aluno estudou, quanto tempo, dificuldades relatadas
```

---

## Ordem de Implementação Recomendada

```
SPRINT 1 — Fundação (já feito ✅)
  Autenticação, alunos, peças, exercícios, checklist, plano semanal básico

SPRINT 2 — Pomodoro e sessões (próximo)
  Cronômetro, ciclos, registro de sessão, comentários

SPRINT 3 — Planos de estudo
  SQL das novas tabelas
  Interface de criação de planos
  Vinculação de repertório ao plano
  Algoritmo de geração do plano semanal
  Preview e aprovação

SPRINT 4 — Metas e concertos
  Criação de metas vinculadas à checklist
  Concertos com vinculação de peças
  Metas automáticas sugeridas ao vincular peça a concerto

SPRINT 5 — Histórico e evolução
  Log de sessões por aluno
  Linha do tempo por peça
  Alimentação do algoritmo (score baseado em histórico real)

SPRINT 6 — Polimento
  Toasts, loading states, empty states
  Responsividade revisada
  Deploy Vercel + produção Supabase
```
