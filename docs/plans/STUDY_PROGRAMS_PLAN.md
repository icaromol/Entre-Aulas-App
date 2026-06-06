# Planejamento de Estudos — Plano de Implementação

## Visão Geral

Três conceitos centrais:

| Conceito | Tabela | O que é |
|---|---|---|
| **Programa** | `programas` | Agrupa o repertório do aluno em torno de um objetivo. Substitui `concerts`. Dois comportamentos: `regular` inclui tudo automaticamente; demais tipos requerem vinculação manual de peças/exercícios. |
| **Planejamento de Estudos** | `weekly_plans` + `plan_items` | O plano gerado. O professor seleciona quais programas entram, atribui pesos (%) a cada um, e o algoritmo distribui os itens de checklist nos dias disponíveis do aluno. |
| **Manutenção** | `plan_items` (is_maintenance=true) | Ciclo rotativo de revisão para peças já concluídas (completion_pct = 100%). Ocupa ~20% do tempo de estudo. Peças mais difíceis aparecem com mais frequência. |

> **Metas (goals) são removidas do sistema.** Tabela, páginas e rotas de goals/metas são descontinuadas.

---

## Tipos de Programa

| Tipo | Comportamento na geração | Prazo |
|---|---|---|
| `regular` | Inclui **todos** os pieces/exercises ativos do aluno automaticamente. Não precisa vincular repertório. | Sem prazo (aulas contínuas) |
| `recital` | Professor vincula peças/exercícios específicos. | Obrigatório |
| `concerto` | Professor vincula peças/exercícios específicos. | Obrigatório |
| `show` | Professor vincula peças/exercícios específicos. | Obrigatório |
| `gravacao` | Professor vincula peças/exercícios específicos. | Obrigatório |
| `exame` | Professor vincula peças/exercícios específicos. | Obrigatório |
| `participacao` | Professor vincula peças/exercícios específicos. | Opcional |
| `outro` | Professor vincula peças/exercícios específicos. | Opcional |

---

## Fluxo Completo

```
1. Professor cria Programas para o aluno
   → "Aulas Regulares" (type=regular) — entra tudo ativo, sem configurar repertório
   → "Concerto Primavera" (type=concerto) — prazo: 20/09
        Vincula: Sonata em Fá, Prelúdio Op.28, Exercício de Escalas

2. Professor clica "Gerar Planejamento"
   → Se não tem nenhum programa: tela de onboarding
        "Você ainda não tem um programa. Qual é o objetivo do aluno?"
        [ Aulas Regulares ]  [ Recital ]  [ Concerto ]  [ Gravação ]  [ Exame ]  …
   → Se tem programas: abre modal de geração

3. Modal de geração
   → Seleciona programas (checkbox)
   → Define pesos: Concerto 70%  |  Aulas Regulares 30%  (sliders, soma = 100%)
   → Horizonte: 1 sem / 2 sem / 1 mês / Personalizado
   → Preview por dia → professor ajusta se quiser → Confirmar

4. Plano salvo
   → plan_items com checklist_item_id + program_id
   → Aluno vê o plano do dia em TodayPage

5. Aluno estuda → registra sessão → completion_pct atualiza
   → Próxima geração já considera o progresso novo
```

---

## Banco de Dados

### Tabela: `programas` (substitui `concerts`)

```sql
CREATE TABLE programas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES teachers(id),
  title        TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'regular'
               CHECK (type IN (
                 'regular', 'recital', 'concerto', 'show',
                 'gravacao', 'exame', 'participacao', 'outro'
               )),
  deadline     DATE,
  venue        TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'completed', 'archived')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE programas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_manage_programas" ON programas
  FOR ALL USING (teacher_id = fn_my_teacher_id());

CREATE POLICY "student_view_programas" ON programas
  FOR SELECT USING (student_id = fn_my_student_id());
```

### Tabela: `program_pieces`

```sql
-- Apenas para programas com type != 'regular'
CREATE TABLE program_pieces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  piece_id          UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  priority_override SMALLINT CHECK (priority_override BETWEEN 1 AND 10),
  UNIQUE (program_id, piece_id)
);

ALTER TABLE program_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_manage_program_pieces" ON program_pieces
  FOR ALL USING (
    program_id IN (SELECT id FROM programas WHERE teacher_id = fn_my_teacher_id())
  );

CREATE POLICY "student_view_program_pieces" ON program_pieces
  FOR SELECT USING (
    program_id IN (SELECT id FROM programas WHERE student_id = fn_my_student_id())
  );
```

### Tabela: `program_exercises`

```sql
CREATE TABLE program_exercises (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  exercise_id       UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  priority_override SMALLINT CHECK (priority_override BETWEEN 1 AND 10),
  UNIQUE (program_id, exercise_id)
);

ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_manage_program_exercises" ON program_exercises
  FOR ALL USING (
    program_id IN (SELECT id FROM programas WHERE teacher_id = fn_my_teacher_id())
  );

CREATE POLICY "student_view_program_exercises" ON program_exercises
  FOR SELECT USING (
    program_id IN (SELECT id FROM programas WHERE student_id = fn_my_student_id())
  );
```

### Tabela: `plan_programs` (registro de qual geração usou quais programas e pesos)

```sql
CREATE TABLE plan_programs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  program_id     UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  weight         SMALLINT NOT NULL DEFAULT 100
                 CHECK (weight BETWEEN 1 AND 100),
  UNIQUE (weekly_plan_id, program_id)
);

ALTER TABLE plan_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_manage_plan_programs" ON plan_programs
  FOR ALL USING (
    weekly_plan_id IN (
      SELECT id FROM weekly_plans WHERE student_id IN (
        SELECT id FROM students WHERE teacher_id = fn_my_teacher_id()
      )
    )
  );
```

### Alteração em `plan_items`

```sql
-- Limpar dados legados (start fresh)
DELETE FROM plan_items;
DELETE FROM weekly_plans;

ALTER TABLE plan_items
  ADD COLUMN checklist_item_id UUID REFERENCES checklist_items(id) ON DELETE CASCADE,
  ADD COLUMN program_id        UUID REFERENCES programas(id) ON DELETE SET NULL;

-- piece_id e exercise_id derivados via checklist_items.piece_id / exercise_id
```

### Remoção de `goals` / `concerts`

```sql
-- Executar após garantir que não há dados importantes
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS concerts CASCADE;
```

---

## Algoritmo de Geração

### Arquivo: `src/lib/planGenerator.ts`

#### Inputs

```ts
interface GeneratorInput {
  studentId: string
  programs: Array<{
    program: Programa
    weight: number               // 1–100, soma dos pesos = 100
    pieces: ProgramPiece[]       // vazio se type='regular' (busca tudo ativo)
    exercises: ProgramExercise[] // vazio se type='regular'
  }>
  availability: StudentAvailability[]
  horizon: 'week' | 'biweek' | 'month' | number
  weekStart: string              // YYYY-MM-DD (sempre segunda)
  includeRevision: boolean
}
```

#### Coleta de checklist_items por programa

```
Se program.type === 'regular':
  → busca todos pieces/exercises do aluno com status='active'
  → coleta todos os checklist_items dessas peças/exercícios

Se program.type !== 'regular':
  → usa apenas as pieces/exercises vinculadas via program_pieces / program_exercises
  → coleta todos os checklist_items dessas peças/exercícios

Filtro final:
  → Se includeRevision=false: remove items com checklist_completion existente
  → Se includeRevision=true: itens concluídos entram com isRevision=true
```

#### Alocação de minutos por programa

O peso define a proporção dos minutos totais disponíveis no período:

```
total_minutes = soma de (day.minutes_available) para todos os dias do horizonte

program_A_minutes = total_minutes × (weight_A / 100)
program_B_minutes = total_minutes × (weight_B / 100)
```

Cada programa opera independentemente dentro da sua cota de minutos.

#### Priority Score (por checklist_item, dentro do programa)

```
score = (0.50 × difficulty_score) + (0.50 × incompletion_score) + urgency_bonus
```

| Componente | Cálculo |
|---|---|
| `difficulty_score` | `piece.difficulty / 10` ou `exercise.difficulty / 10`. Se `priority_override` definido, usa ele `/10`. |
| `incompletion_score` | `1 - (completion_pct / 100)` |
| `urgency_bonus` | Somado ao score final (não multiplicado) — ver tabela abaixo |

**Urgency bonus por prazo do programa:**

| Dias até o prazo | urgency_bonus |
|---|---|
| < 7 | +0.40 |
| 7–14 | +0.30 |
| 15–30 | +0.20 |
| 31–60 | +0.10 |
| > 60 ou sem prazo | +0.00 |

**Modificadores:**
- `is_optional = true`: `score × 0.30` (candidatos a remoção no overflow)
- `isRevision = true`: `score × 0.50`

#### Frequência por item

```
available_days = dias ativos no período (student_availability × semanas)
freq = max(1, round(score × 3))
freq = min(freq, available_days)
```

#### Distribuição

1. Para cada programa: expandir lista de itens com suas frequências
2. Ordenar por `score DESC`
3. Round-robin ponderado pelos `minutes_available` de cada dia
4. `duration_per_task = floor(day.program_minutes_remaining / tasks_remaining_today)`
5. **Overflow**: remover `is_optional` → reduzir `freq` dos menores scores → avisar quantos não couberam
6. Intercalar itens de diferentes programas por dia (evitar dias só com um programa)

#### Outputs

```ts
interface GeneratedPlan {
  days: GeneratedDay[]
  unscheduled: PlannedTask[]
  stats: {
    totalTasks: number
    scheduledTasks: number
    periodsGenerated: number
    minutesByProgram: Record<string, number>
  }
}

interface GeneratedDay {
  weekStart: string
  dayOfWeek: number
  date: string
  minutesAvailable: number
  minutesUsed: number
  tasks: PlannedTask[]
}

interface PlannedTask {
  checklistItemId: string
  checklistItemTitle: string
  sourceType: 'piece' | 'exercise'
  sourceId: string
  sourceTitle: string
  programId: string
  programTitle: string
  durationMinutes: number
  isRevision: boolean
  isOptional: boolean
  score: number
}
```

---

## Manutenção de Obras Concluídas

### Conceito

Quando uma peça atinge `completion_pct = 100%`, ela passa automaticamente para o **pool de manutenção**. Esse pool é um ciclo rotativo: o algoritmo percorre todas as peças concluídas do aluno de forma circular, garantindo que todas sejam revisadas periodicamente, com frequência proporcional à dificuldade.

A manutenção ocupa uma fatia separada do tempo disponível (~20% por padrão). É opcional: um checkbox no modal de geração permite ativá-la ou desativá-la por planejamento.

### Comportamento da rotação

```
Peças concluídas do aluno:
  Sonata em Fá        dificuldade 9   última manutenção: 28/05
  Valsa Op.64         dificuldade 5   última manutenção: 15/05
  Étude de Chopin     dificuldade 8   última manutenção: nunca
  Prelúdio BWV        dificuldade 4   última manutenção: 01/06

Ordem de prioridade na rotação:
  1º Étude (nunca revisado)
  2º Valsa (mais antiga: 15/05)
  3º Sonata (28/05)
  4º Prelúdio (mais recente: 01/06)

Distribuição do tempo de manutenção (proporcional à dificuldade):
  Étude:   8 / 26 = 31% do budget de manutenção
  Sonata:  9 / 26 = 35%
  Valsa:   5 / 26 = 19%
  Prelúdio:4 / 26 = 15%
```

### Como a tarefa de manutenção aparece no plano

Tarefas de manutenção **não quebram em checklist_items** — a peça está dominada, o objetivo é manter a memória muscular. Cada tarefa de manutenção referencia a peça diretamente:

```
plan_items (manutenção):
  is_maintenance = true
  piece_id       = <id da peça concluída>
  checklist_item_id = NULL
  duration_minutes  = calculado pelo algoritmo
  program_id        = NULL
```

**Display no card:**
```
┌─────────────────────────────────────────────┐
│ 🔄 Manutenção                    20 min     │
│                                              │
│ Étude de Chopin Op.10 nº 1                  │
│ Última revisão: há 21 dias                   │
│                                              │
│ [ ▶ Pomodoro ]   [ ✓ Marcar feito ]         │
└─────────────────────────────────────────────┘
```

### Schema — alterações necessárias

```sql
-- Adicionar flag de manutenção e piece_id direto em plan_items
-- (piece_id já existe no schema atual como coluna legada — reutilizar)
ALTER TABLE plan_items
  ADD COLUMN is_maintenance BOOLEAN NOT NULL DEFAULT false;

-- piece_id já existe; garantir que permanece nullable (já é)
-- Regra: quando is_maintenance=true, piece_id deve estar preenchido e checklist_item_id=NULL
-- Quando is_maintenance=false, checklist_item_id deve estar preenchido e piece_id=NULL
```

**Histórico de manutenção** é derivado diretamente dos `plan_items`:

```sql
-- "Última vez que a Sonata foi estudada para manutenção":
SELECT MAX(updated_at)
FROM plan_items
WHERE piece_id = :piece_id
  AND is_maintenance = true
  AND is_done = true
```

Não é necessária tabela separada. O histórico completo fica nos `plan_items` preservados.

### Algoritmo de Manutenção

```ts
interface MaintenanceInput {
  enabled: boolean           // checkbox no modal
  budgetPercent: number      // padrão: 20
  completedPieces: Array<{
    piece: Piece
    lastMaintenanceOn: string | null  // derivado de plan_items
  }>
  totalMinutesInPeriod: number
}

function buildMaintenanceTasks(input: MaintenanceInput): PlannedTask[] {
  if (!input.enabled || input.completedPieces.length === 0) return []

  const budgetMinutes = Math.floor(
    input.totalMinutesInPeriod * (input.budgetPercent / 100)
  )

  // 1. Ordenar por prioridade de rotação:
  //    NULL (nunca revisado) vem primeiro → depois por lastMaintenanceOn ASC
  const sorted = [...input.completedPieces].sort((a, b) => {
    if (!a.lastMaintenanceOn) return -1
    if (!b.lastMaintenanceOn) return 1
    return a.lastMaintenanceOn.localeCompare(b.lastMaintenanceOn)
  })

  // 2. Calcular peso proporcional à dificuldade
  const totalDifficulty = sorted.reduce(
    (sum, p) => sum + (p.piece.difficulty ?? 5), 0
  )

  // 3. Alocar minutos por peça
  return sorted.map(({ piece }) => {
    const weight = (piece.difficulty ?? 5) / totalDifficulty
    const minutes = Math.max(10, Math.round(budgetMinutes * weight))
    return {
      checklistItemId: null,
      checklistItemTitle: `Manutenção — ${piece.title}`,
      sourceType: 'piece',
      sourceId: piece.id,
      sourceTitle: piece.title,
      programId: null,
      programTitle: 'Manutenção',
      durationMinutes: minutes,
      isRevision: false,
      isOptional: false,
      isMaintenance: true,
      score: weight,
    }
  })
}
```

### Integração com o algoritmo principal

```
total_minutes = soma de minutes_available no período

maintenance_minutes = total_minutes × budgetPercent / 100
study_minutes       = total_minutes - maintenance_minutes

// Programas e pesos operam sobre study_minutes (não sobre total_minutes)
program_A_minutes = study_minutes × (weight_A / 100)
program_B_minutes = study_minutes × (weight_B / 100)

// Tarefas de manutenção são distribuídas nos dias com tempo disponível restante
// após as tarefas normais, garantindo intercalação (não acumular tudo num dia)
```

### Modal de Geração — alteração no Passo 1

```
☑ Incluir obras de manutenção
  Budget de manutenção:  [██░░░░░░░░] 20%
  Peças elegíveis: 4 obras concluídas

  Étude de Chopin Op.10 nº 1   (dificuldade 8)   nunca revisado
  Valsa Op.64 nº 1             (dificuldade 5)   há 22 dias
  Sonata em Fá                 (dificuldade 9)   há 9 dias
  Prelúdio BWV 846             (dificuldade 4)   há 5 dias
```

O slider do budget de manutenção ajusta automaticamente os sliders de peso dos programas (soma continua 100% do tempo restante).

### Fases de implementação — adições

**Fase 1 (DB):**
- [ ] Adicionar `is_maintenance BOOLEAN DEFAULT false` em `plan_items`

**Fase 4 (Modal):**
- [ ] Checkbox "Incluir obras de manutenção" com slider de budget
- [ ] Preview lista peças elegíveis com dias desde última revisão

**Fase 5 (PlanejamentoPage):**
- [ ] Renderizar cards de manutenção com badge 🔄 e "última revisão há X dias"
- [ ] Ao marcar `is_done=true` em item de manutenção: atualizar timestamp (já salvo via updated_at)

**Fase 6 (TodayPage):**
- [ ] Cards de manutenção com badge distinto
- [ ] Mostrar "última revisão há X dias" como subtext

---

## Navegação e Rotas

### Tabs no perfil do aluno (professor)

```
Peças | Exercícios | Programas
```

"Plano" e "Tarefas/Metas" removidos como tabs. O Planejamento é acessado pelo botão "Gerar Planejamento" dentro da aba Programas.

### Rotas novas

```
/professor/alunos/:studentId/programas
  → ProgramasPage (aba do perfil — lista + botão gerar planejamento)

/professor/alunos/:studentId/programas/novo
  → NewProgramaPage

/professor/alunos/:studentId/programas/:programId
  → ProgramaDetailPage

/professor/alunos/:studentId/programas/:programId/editar
  → EditProgramaPage

/professor/alunos/:studentId/planejamento
  → PlanejamentoPage (substitui WeeklyPlanPage — exibe plano + botão gerar)
```

### Rotas removidas

```
/professor/alunos/:studentId/plano
/professor/alunos/:studentId/metas (se existia)
Qualquer rota de goals/metas
```

---

## UI — Fluxo Detalhado

### Aba "Programas" no perfil do aluno

Dois estados:

**Estado vazio (sem programas):**
```
┌─────────────────────────────────────────────┐
│  🎵                                         │
│  Nenhum programa criado                     │
│  Crie um programa para começar a gerar      │
│  o planejamento de estudos do aluno.        │
│                                             │
│  [ + Criar primeiro programa ]              │
└─────────────────────────────────────────────┘
```

**Com programas:**
```
[ + Novo Programa ]          [ ▶ Gerar Planejamento ]

┌── Concerto Primavera ──────────────────────┐
│  🎼 Concerto  ·  em 45 dias  ·  3 peças   │
│  Ativo                                      │
└─────────────────────────────────────────────┘

┌── Aulas Regulares ─────────────────────────┐
│  📚 Regular  ·  12 peças e exercícios ativos│
│  Ativo                                      │
└─────────────────────────────────────────────┘
```

### NewProgramaPage / EditProgramaPage

Campos:
- Título (obrigatório)
- Tipo: grid de botões (Regular / Recital / Concerto / Show / Gravação / Exame / Participação / Outro)
- Prazo: date picker (obrigatório para tipos com prazo, oculto para Regular)
- Local/Venue (opcional)
- Observações

Para tipo Regular: sem seção de repertório (tudo ativo entra automaticamente).

### ProgramaDetailPage

**Para tipo `regular`:**
```
Aulas Regulares
Inclui todo o repertório ativo do aluno (12 itens)

[ Editar ] [ Arquivar ]
```

**Para outros tipos:**
```
Concerto Primavera
🎼 Concerto  ·  20/09/2025  ·  Teatro Municipal

Repertório do programa:
  ◉ Sonata em Fá  ──────── 34% ──░░░░░  compositor
  ◉ Prelúdio Op.28 ─────── 67% ────░░░  compositor
  ◉ Escalas Maiores ─────── 60% ───░░░  (exercício)

[ + Vincular peça ] [ + Vincular exercício ]
[ Editar programa ] [ Arquivar ]
```

### Modal de Geração — 2 passos

**Passo 1 — Configuração:**
```
Horizonte:
  [ 1 semana ]  [ 2 semanas ]  [ 1 mês ]  [ ___ sem ]

Início: [ Seg, 09/06/2025 ]

Programas e prioridade:
  ☑ Concerto Primavera          [████░░░░░░] 70%
    prazo: 20/09 — em 106 dias

  ☑ Aulas Regulares             [███░░░░░░░] 30%
    repertório completo ativo

  ☐ Show de Encerramento
    prazo: 15/12

  ─────────────────────────────
  Total: 100%  ✓

  ☐ Incluir itens já concluídos como revisão

[ Próximo → ]
```

**Passo 2 — Preview:**
```
Seg 09/06  |  45 min
  🎼 [Concerto] Sonata em Fá → Tocar sem parar      16 min
  🎼 [Concerto] Escalas → Escala de Dó              16 min
  📚 [Regular] Prelúdio → Dedilhado comp.8           13 min

Qua 11/06  |  30 min
  🎼 [Concerto] Sonata em Fá → Tocar sem parar      15 min
  📚 [Regular] Harmonia → Formação de tríades        15 min

Sex 13/06  |  60 min
  🎼 [Concerto] Sonata → Arco na seção B             20 min
  🎼 [Concerto] Escalas → Escala de Sol              20 min
  📚 [Regular] Prelúdio → Pedal na coda              20 min

Seg 16/06  |  45 min
  ...

⚠ 2 itens opcionais não couberam no período.

[ ← Voltar ]   [ Confirmar e salvar plano ]
```

### PlanejamentoPage (substitui WeeklyPlanPage)

Card por `plan_item`:
```
┌────────────────────────────────────────────┐
│ 🎼 Concerto Primavera          16 min      │
│                                             │
│ Sonata em Fá                               │
│ Tocar sem parar                            │
│                                             │
│ [ ▶ Pomodoro ]    [ ✓ Marcar feito ]       │
└────────────────────────────────────────────┘
```

Ações do professor:
- Remover item do dia
- Adicionar tarefa avulsa manualmente
- Navegar entre semanas
- Botão **"Gerar novo planejamento"** → modal pré-preenche com programas da última geração

---

## Descontinuação de Goals / Concerts

### Tabelas a remover do banco
```sql
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS concerts CASCADE;
```

### Páginas/componentes a remover do código
```
src/pages/teacher/NewGoalPage.tsx
src/pages/teacher/EditGoalPage.tsx
src/pages/student/GoalsPage.tsx
```

### Rotas a remover de router.tsx
```
/professor/alunos/:studentId/metas/nova
/professor/alunos/:studentId/metas/:goalId/editar
/aluno/metas
```

### StudentProfilePage
- Remover tab "Tarefas" e toda lógica de goals

---

## Fases de Implementação

### Fase 1 — DB + Tipos
- [ ] Criar `programas` + RLS
- [ ] Criar `program_pieces` + RLS
- [ ] Criar `program_exercises` + RLS
- [ ] Criar `plan_programs` + RLS
- [ ] Alterar `plan_items`: adicionar `checklist_item_id`, `program_id`
- [ ] Limpar `plan_items` e `weekly_plans` existentes
- [ ] Remover `goals` e `concerts` (após backup)
- [ ] Criar `src/types/programs.ts`

### Fase 2 — CRUD de Programas
- [ ] `ProgramasPage` (aba no perfil do aluno — lista + estados vazio/com programas)
- [ ] `NewProgramaPage` (form com tipo, prazo condicional, venue)
- [ ] `ProgramaDetailPage` (comportamento diferente por tipo)
- [ ] `EditProgramaPage`
- [ ] Picker de peças/exercícios para vincular ao programa
- [ ] Atualizar `StudentProfilePage`: trocar tabs (remover Plano/Tarefas, adicionar Programas)
- [ ] Atualizar `router.tsx`

### Fase 3 — Algoritmo
- [ ] `src/lib/planGenerator.ts`
  - Coleta de checklist_items (regular=tudo ativo vs específico)
  - Alocação de minutos por peso de programa
  - Priority score + urgency bonus
  - Frequência por item
  - Distribuição round-robin com intercalação entre programas
  - Overflow: remover opcionais → reduzir freq → report
- [ ] Testes unitários

### Fase 4 — Modal de Geração + Preview
- [ ] `GeneratePlanejamentoModal` (2 passos)
  - Seletor de programas + sliders de peso (soma = 100%)
  - Seletor de horizonte
  - Preview por dia com badge de programa
- [ ] Onboarding: se sem programas, mostrar prompt de criação inline
- [ ] Salvar: `DELETE plan_items` do período → `INSERT` novos + `plan_programs`

### Fase 5 — PlanejamentoPage
- [ ] Query: `plan_items → checklist_items → pieces/exercises + programs`
- [ ] Cards com badge de programa, nome do item, peça/exercício de origem
- [ ] Navegação entre semanas
- [ ] Edição manual
- [ ] "Gerar novo planejamento" com pré-preenchimento

### Fase 6 — TodayPage (aluno)
- [ ] Query adaptada para `checklist_item_id`
- [ ] Badge de programa nos cards
- [ ] Integração com Pomodoro existente

### Fase 7 — Remoção de Goals
- [ ] Remover `NewGoalPage`, `EditGoalPage`, `GoalsPage`
- [ ] Remover tab "Tarefas" de `StudentProfilePage`
- [ ] Remover rotas de goals de `router.tsx`
- [ ] Remover `plan_programs` da tab de aluno (bottom nav)

### Fase 8 (futuro) — Algoritmo adaptativo
- [ ] Incorporar `study_sessions` no score
- [ ] Dashboard de histórico de prática vs planejamento

---

## Tipos TypeScript

```ts
// src/types/programs.ts

export type ProgramaType =
  | 'regular' | 'recital' | 'concerto' | 'show'
  | 'gravacao' | 'exame' | 'participacao' | 'outro'

export type ProgramaStatus = 'active' | 'completed' | 'archived'

export interface Programa {
  id: string
  student_id: string
  teacher_id: string
  title: string
  type: ProgramaType
  deadline: string | null
  venue: string | null
  status: ProgramaStatus
  notes: string | null
  created_at: string
}

export interface ProgramPiece {
  id: string
  program_id: string
  piece_id: string
  priority_override: number | null
  piece?: {
    id: string; title: string; composer: string | null
    difficulty: number | null; completion_pct: number
  }
}

export interface ProgramExercise {
  id: string
  program_id: string
  exercise_id: string
  priority_override: number | null
  exercise?: {
    id: string; title: string
    category: string; difficulty: number | null
  }
}

export interface PlanProgram {
  id: string
  weekly_plan_id: string
  program_id: string
  weight: number
}
```

---

## Critérios de Aceite

| Teste | Esperado |
|---|---|
| Aluno sem programas → clicar "Gerar Planejamento" | Tela de onboarding: "Qual é o objetivo do aluno?" com opções de tipo |
| Criar programa "Aulas Regulares" | Aba Programas mostra card com "X itens ativos", sem seção de repertório |
| Criar programa "Concerto Primavera" | ProgramaDetailPage permite vincular peças/exercícios específicos |
| Modal de geração: 2 programas, pesos 70/30 | Preview mostra proporção correta de tarefas por programa |
| Pesos não somam 100% | Botão "Próximo" desabilitado com aviso "Total: 87% — ajuste os pesos" |
| Peça difficulty=9, completion=10%, prazo < 14 dias | Item aparece com freq 3× no preview |
| Confirmar planejamento | plan_items com checklist_item_id; plan_programs salvo com pesos |
| Aluno abre TodayPage | Cards com badge do programa + nome do item + peça de origem |
| Navegar para `/aluno/metas` (rota antiga) | Redireciona para 404 |
| Peça atinge completion_pct = 100% | Aparece no painel de manutenção do modal de geração |
| Modal: ativar manutenção (20%), 4 peças concluídas | Preview mostra tasks de manutenção intercaladas nos dias; budget total = study + maintenance = 100% |
| Peça dificuldade=9 e peça dificuldade=4 no pool | Peça dificuldade=9 recebe ~69% do budget de manutenção |
| Peça "nunca revisada" no pool | Aparece PRIMEIRO na rotação, independente da dificuldade |
| Aluno conclui tarefa de manutenção (is_done=true) | `updated_at` salvo; próxima geração move essa peça para o fim da fila |
| Desativar checkbox de manutenção | Nenhum plan_item com is_maintenance=true é gerado |
