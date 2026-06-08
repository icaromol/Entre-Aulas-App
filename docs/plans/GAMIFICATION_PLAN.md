# estudamus — Plano de Gamificação

| Campo | Valor |
|---|---|
| **Versão** | 1.0 |
| **Data** | 2026-06-08 |
| **Status** | Aprovado — aguardando implementação |
| **Contexto** | Loop central de retenção entre aulas |

---

## Problema a resolver

O estudamus hoje é usado principalmente **durante** a aula ou logo antes dela. O objetivo deste módulo é criar motivação intrínseca para o aluno abrir o app **entre** as aulas — sem que o professor precise lembrá-lo.

O critério de sucesso não é "o aluno ganhou XP". É: **o aluno abre o app em dias que não tem aula.**

---

## Decisões de design (confirmadas)

| Decisão | Escolha | Motivo |
|---|---|---|
| O que evolui | Jornada musical (6 regiões) | Conecta com aprendizado real, não com número genérico |
| Como progride | Automático por XP acumulado | Sem fricção de validação manual |
| Missões | Camada visual sobre dados existentes | Zero nova entidade de "missão" no banco |
| Atributos musicais | No MVP, desde o início | Evita migração de dados depois |
| Posição na UI | Nova aba "Jornada" (4ª aba do aluno) | TodayPage não é alterada |

---

## Loop central — antes vs depois

**Hoje:**
```
Entrar → Ver plano → Iniciar pomodoro → Finalizar → Sair
```

**Com gamificação:**
```
Entrar → Ver jornada → Ver missão atual → Iniciar estudo → Receber XP → Avançar na jornada
```

A diferença parece pequena. Muda completamente a percepção.

---

## A Jornada Musical — 7 Regiões, 22 Ranks

Cada região tem 4 sub-níveis (4 → 3 → 2 → 1). Expert e Mestre são tier único.
Thresholds calibrados para ~1.000 XP/mês de uso ativo.

### Tabela completa de ranks

| Rank | XP mínimo | Referência |
|---|---|---|
| Aprendiz 4 | 0 | início |
| Aprendiz 3 | 250 | |
| Aprendiz 2 | 500 | |
| Aprendiz 1 | 750 | |
| Estudante 4 | 1.000 | ~1 mês |
| Estudante 3 | 2.250 | |
| Estudante 2 | 3.500 | |
| Estudante 1 | 4.750 | |
| Amador 4 | 6.000 | ~6 meses |
| Amador 3 | 7.500 | |
| Amador 2 | 9.000 | |
| Amador 1 | 10.500 | |
| Júnior 4 | 12.000 | ~1 ano |
| Júnior 3 | 15.250 | |
| Júnior 2 | 18.500 | |
| Júnior 1 | 21.750 | |
| Profissional 4 | 25.000 | ~2 anos |
| Profissional 3 | 31.250 | |
| Profissional 2 | 37.500 | |
| Profissional 1 | 43.750 | |
| Expert | 50.000 | ~4 anos |
| Mestre | 100.000 | ~8 anos — quase inalcançável |

### Lógica dos sub-níveis

Cada região divide seu range XP em 4 partes iguais:
- Aprendiz (range 1.000): saltos de 250
- Estudante (range 5.000): saltos de 1.250
- Amador (range 6.000): saltos de 1.500
- Júnior (range 13.000): saltos de 3.250
- Profissional (range 25.000): saltos de 6.250
- Expert e Mestre: tier único, sem sub-níveis

### Representação no código

```ts
type Rank = {
  region: string        // 'Aprendiz', 'Estudante', 'Expert', ...
  level: number | null  // 4, 3, 2, 1 — null para Expert e Mestre
  xpMin: number
  display: string       // 'Aprendiz 4', 'Júnior 2', 'Expert', 'Mestre'
}

const RANKS: Rank[] = [
  { region: 'Aprendiz',      level: 4, xpMin: 0,       display: 'Aprendiz 4' },
  { region: 'Aprendiz',      level: 3, xpMin: 250,     display: 'Aprendiz 3' },
  { region: 'Aprendiz',      level: 2, xpMin: 500,     display: 'Aprendiz 2' },
  { region: 'Aprendiz',      level: 1, xpMin: 750,     display: 'Aprendiz 1' },
  { region: 'Estudante',     level: 4, xpMin: 1000,    display: 'Estudante 4' },
  { region: 'Estudante',     level: 3, xpMin: 2250,    display: 'Estudante 3' },
  { region: 'Estudante',     level: 2, xpMin: 3500,    display: 'Estudante 2' },
  { region: 'Estudante',     level: 1, xpMin: 4750,    display: 'Estudante 1' },
  { region: 'Amador',        level: 4, xpMin: 6000,    display: 'Amador 4' },
  { region: 'Amador',        level: 3, xpMin: 7500,    display: 'Amador 3' },
  { region: 'Amador',        level: 2, xpMin: 9000,    display: 'Amador 2' },
  { region: 'Amador',        level: 1, xpMin: 10500,   display: 'Amador 1' },
  { region: 'Júnior',        level: 4, xpMin: 12000,   display: 'Júnior 4' },
  { region: 'Júnior',        level: 3, xpMin: 15250,   display: 'Júnior 3' },
  { region: 'Júnior',        level: 2, xpMin: 18500,   display: 'Júnior 2' },
  { region: 'Júnior',        level: 1, xpMin: 21750,   display: 'Júnior 1' },
  { region: 'Profissional',  level: 4, xpMin: 25000,   display: 'Profissional 4' },
  { region: 'Profissional',  level: 3, xpMin: 31250,   display: 'Profissional 3' },
  { region: 'Profissional',  level: 2, xpMin: 37500,   display: 'Profissional 2' },
  { region: 'Profissional',  level: 1, xpMin: 43750,   display: 'Profissional 1' },
  { region: 'Expert',        level: null, xpMin: 50000,  display: 'Expert' },
  { region: 'Mestre',        level: null, xpMin: 100000, display: 'Mestre' },
]
```

**Base de cálculo (~1.000 XP/mês para aluno ativo):**
- ~20 sessões pomodoro × 5 XP = 100
- ~20 itens de checklist marcados × 15 XP = 300
- Missões diárias e semanais ≈ 400
- Peças concluídas + recitais ≈ 200

---

## Sistema de XP

### Regras de ganho

| Evento | XP | Observação |
|---|---|---|
| Sessão pomodoro concluída | +5 | Por sessão, independente da duração |
| Checklist item marcado | +15 | Apenas quando `is_done = false → true` em `plan_items` |
| Peça concluída (`completion_pct = 100`) | +300 | Trigger em `checklist_completions` |
| Programa realizado (recital/show/concerto) | +1.000 | Quando professor marca programa como concluído |
| Missão diária concluída | +20 | Ao marcar todos `plan_items` do dia como `is_done = true` |
| Missão semanal — estudar 4 dias | +75 | Computado via `study_sessions` |
| Missão semanal — 5 itens na semana | +50 | Computado via `plan_items.is_done` |

### O que NÃO dá XP

- Tempo no app sem fazer nada
- Criar peças/exercícios (ação do professor)
- Scroll pelo repertório

**Princípio:** tempo + resultado. Estudar sem avançar não gera avanço.

---

## Atributos Musicais

Nove atributos que crescem separados. O aluno passa a enxergar suas forças.

Atributos marcados com * não têm exercícios mapeados no MVP — existem no schema e aparecem na tela (começando em 0), mas só recebem dados quando o professor criar exercícios nessas categorias.

| Atributo | Chave no banco | Descrição | Status no MVP |
|---|---|---|---|
| Técnica | `tecnica` | Controle físico do instrumento | Ativo |
| Leitura | `leitura` | Leitura de partitura e cifra | Sem exercícios por ora* |
| Ritmo | `ritmo` | Precisão rítmica e metrônomo | Sem exercícios por ora* |
| Musicalidade | `musicalidade` | Expressão, dinâmica, fraseado | Ativo (peças) |
| Performance | `performance` | Tocar para outros, palco | Ativo (programas) |
| Percepção | `percepcao` | Ouvido melódico e harmônico | Ativo |
| Improvisação | `improvisacao` | Criação musical espontânea | Sem exercícios por ora* |
| Teoria Musical | `teoria` | Harmonia, escalas, análise | Ativo |
| História da Música | `historia` | Contexto histórico e cultural | Ativo |

### Mapeamento — o que alimenta cada atributo

| Fonte | Atributo | Regra |
|---|---|---|
| Exercício `technique` | Técnica | Categoria direta |
| Exercício `ear_training` | Percepção | Categoria direta |
| Exercício `harmony` | Teoria Musical | Harmonia é teoria aplicada |
| Exercício `improvisation` | Improvisação | Categoria direta |
| Exercício `history` | História da Música | Categoria direta |
| Exercício `other` | Técnica | Fallback |
| Peça qualquer | Musicalidade | Default para peças |
| Programa recital/show/concerto concluído | Performance | Pela natureza do programa |

**Leitura e Ritmo** não têm categoria de exercício mapeada hoje. Quando o professor criar exercícios com essas categorias no futuro, o mapeamento já existirá no banco — sem migração.

O XP de atributo é **o mesmo valor** do XP total do evento. O campo `attribute` em `student_xp_events` registra qual atributo foi alimentado. O total por atributo é `SUM(amount) WHERE attribute = 'tecnica'`.

---

## Missões — sem nova entidade no banco

Missões são uma **camada de apresentação** sobre dados existentes. Nenhuma tabela nova de "missão".

| Tipo de missão | Fonte | Lógica |
|---|---|---|
| Missões ativas | `pieces` + `programas` | Peças com `completion_pct < 100` e status ativo |
| Missão do dia | `plan_items` | Itens do dia com `is_done = false` |
| Próximo evento | `programas` | Tipo ≠ 'regular', com `deadline` mais próximo |
| Streak | `study_sessions` | Dias consecutivos com ≥ 1 sessão |
| Missão semanal | `study_sessions` + `plan_items` | Computado da semana corrente |

---

## Missões Semanais — lógica de geração

A cada início de semana (segunda-feira), o app gera **2–3 missões semanais** fixas a partir dos dados do aluno. Não são salvas no banco — computadas sob demanda.

Exemplos de missões semanais geradas:

| Condição | Missão exibida | Recompensa |
|---|---|---|
| Aluno tem plano semanal com ≥ 4 dias | "Estudar 4 dias esta semana" | +75 XP |
| Aluno tem ≥ 3 peças ativas | "Avançar 2 itens de checklist" | +50 XP |
| Aluno tem plano com pomodoros | "Completar 3 pomodoros" | +60 XP |

Critério de conclusão: computado em `useStudentProgress` sem salvar estado no banco.

---

## Streak — cálculo

```ts
// Dias consecutivos com pelo menos 1 study_session
// Calculado a partir de hoje para trás
// Um dia sem sessão quebra a sequência
// Sessões em dias futuros não contam
```

Baseado em `study_sessions.started_at::date` agrupado por dia. Sem tabela de streak — computado no hook.

---

## Banco de dados — mudanças

### Nova tabela: `student_xp_events`

```sql
CREATE TABLE public.student_xp_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL CHECK (amount > 0),
  attribute    TEXT CHECK (attribute IN (
                 'tecnica', 'leitura', 'ritmo', 'musicalidade',
                 'performance', 'percepcao',
                 'improvisacao', 'teoria', 'historia'
               )), -- nullable para XP sem atributo (missão diária, etc.)
  reason       TEXT NOT NULL CHECK (reason IN (
                 'pomodoro_session',
                 'checklist_item',
                 'piece_completed',
                 'program_completed',
                 'daily_mission',
                 'weekly_mission_streak',
                 'weekly_mission_items',
                 'weekly_mission_pomodoros'
               )),
  source_id    UUID, -- FK flexível: plan_item_id / piece_id / program_id / session_id
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE student_xp_events ENABLE ROW LEVEL SECURITY;

-- Aluno vê apenas os seus
CREATE POLICY "student_sees_own_xp"
  ON student_xp_events FOR SELECT
  USING (student_id = fn_my_student_id());

-- Aluno insere (via app — checklist, pomodoro)
CREATE POLICY "student_inserts_own_xp"
  ON student_xp_events FOR INSERT
  WITH CHECK (student_id = fn_my_student_id());

-- Professor vê xp dos seus alunos (para dashboard futuro)
CREATE POLICY "teacher_sees_student_xp"
  ON student_xp_events FOR SELECT
  USING (fn_is_my_student(student_id));

-- Índice de performance
CREATE INDEX idx_xp_events_student ON student_xp_events(student_id, created_at DESC);
```

### Nova tabela: `student_achievements`

```sql
CREATE TABLE public.student_achievements (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  unlocked_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, achievement_key)
);

ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_sees_own_achievements"
  ON student_achievements FOR SELECT
  USING (student_id = fn_my_student_id());

CREATE POLICY "student_inserts_own_achievements"
  ON student_achievements FOR INSERT
  WITH CHECK (student_id = fn_my_student_id());

CREATE POLICY "teacher_sees_student_achievements"
  ON student_achievements FOR SELECT
  USING (fn_is_my_student(student_id));

CREATE INDEX idx_achievements_student ON student_achievements(student_id);
```

### Achievements disponíveis (MVP)

| Chave | Condição de desbloqueio |
|---|---|
| `first_session` | Primeira sessão pomodoro concluída |
| `first_piece` | Primeira peça com `completion_pct = 100` |
| `streak_3` | 3 dias seguidos |
| `streak_7` | 7 dias seguidos |
| `streak_14` | 14 dias seguidos |
| `streak_30` | 30 dias seguidos |
| `rank_estudante_4` | Chegou em Estudante 4 (1.000 XP) |
| `rank_amador_4` | Chegou em Amador 4 (6.000 XP) |
| `rank_junior_4` | Chegou em Júnior 4 (12.000 XP) |
| `rank_profissional_4` | Chegou em Profissional 4 (25.000 XP) |
| `rank_expert` | Chegou em Expert (50.000 XP) |
| `rank_mestre` | Chegou em Mestre (100.000 XP) |
| `first_recital` | Primeiro programa recital/show concluído |
| `pieces_3` | 3 peças concluídas |
| `pieces_5` | 5 peças concluídas |

---

## Hook `useStudentProgress`

Único ponto de verdade sobre gamificação. Usado por `JourneyPage` e pelo toast de XP.

```ts
// src/hooks/useStudentProgress.ts
interface StudentProgress {
  xpTotal: number
  xpByAttribute: Record<string, number>  // { tecnica: 120, musicalidade: 80, ... }
  region: {
    name: string        // 'Primeiras Músicas'
    index: number       // 1 (0-based)
    xpMin: number       // 500
    xpNext: number      // 2000 (ou Infinity se Artista)
    pct: number         // 78 (%)
  }
  streak: number        // 12 (dias)
  achievements: string[] // ['first_session', 'streak_7', ...]
  activeMissions: {
    id: string
    title: string
    subtitle: string    // nome da peça/exercício
    pct: number
    type: 'piece' | 'exercise' | 'program'
  }[]
  todayMission: {
    total: number
    done: number
    xpReward: number
    completed: boolean
  }
  nextEvent: {
    title: string
    daysUntil: number
    type: string
  } | null
  weeklyMissions: {
    key: string
    label: string
    xpReward: number
    completed: boolean
    progress: number    // 0-1
  }[]
}
```

---

## Tela JourneyPage — estrutura

Rota: `/aluno/jornada`
Layout: `StudentLayout` (4ª aba)

```
┌─────────────────────────────────┐
│  Boa noite, João                │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Primeiras Músicas        │  │
│  │  ██████████░░  78%        │  │
│  │  Próx: Construção de Rep. │  │
│  │  1.240 / 2.000 XP         │  │
│  └───────────────────────────┘  │
│                                 │
│  🔥 12 dias seguidos            │
│                                 │
│  ── Missão do dia ─────────────  │
│  ☑ 4 de 5 itens concluídos      │
│  +20 XP ao completar tudo       │
│                                 │
│  ── Missões ativas ────────────  │
│  🎼 Bourrée em Mi Menor  83%    │
│  🎯 Escalas de Ré Maior  60%    │
│  🎭 Recital Julho        72%    │
│                                 │
│  ── Esta semana ───────────────  │
│  ☑ Estudar 4 dias      +75 XP   │
│  ☐ Completar 3 pomodoros +60 XP │
│                                 │
│  ── Atributos ─────────────────  │
│  Técnica      ██████████  420   │
│  Percepção    ███████     280   │
│  Musicalidade █████████   360   │
│  Performance  ████         80   │
│                                 │
│  ── Conquistas ────────────────  │
│  🏅 Primeira peça concluída     │
│  🏅 7 dias seguidos             │
│  🔒 14 dias seguidos            │
│                                 │
└─────────────────────────────────┘
```

---

## Onde o XP é gerado (gatilhos no frontend)

### 1. Ao marcar `plan_item.is_done = true` (TodayPage)

```ts
// Já existe: PATCH plan_items set is_done=true
// Adicionar após o update:
await grantXp(studentId, 15, 'checklist_item', planItemId, attributeFromItem(item))

// Verificar se todos do dia estão done → +20 XP missão diária
```

### 2. Ao finalizar pomodoro (PomodoroPage — tela de conclusão)

```ts
// Já existe: INSERT study_sessions
// Adicionar após o insert:
await grantXp(studentId, 5, 'pomodoro_session', sessionId, null)
```

### 3. Ao marcar `checklist_completion` de peça (RepertoirePage / TodayPage)

```ts
// Após INSERT checklist_completions:
// Verificar se completion_pct = 100 → +300 XP + achievement 'first_piece'
```

### 4. Função helper `grantXp`

```ts
// src/lib/xpHelpers.ts
async function grantXp(
  studentId: string,
  amount: number,
  reason: string,
  sourceId: string | null,
  attribute: string | null
) {
  await supabase.from('student_xp_events').insert({
    student_id: studentId,
    amount,
    reason,
    source_id: sourceId,
    attribute,
  })
  // Verificar novos achievements
  await checkAchievements(studentId)
}
```

---

## Toast de XP

Ao ganhar XP, exibir toast especial (não o `sonner` padrão — componente próprio ou sonner customizado):

```
+15 XP  ·  Técnica
```

Ao avançar de região:

```
🎉 Nova região desbloqueada!
Construção de Repertório
```

Ao desbloquear achievement:

```
🏅 Conquista: 7 dias seguidos
```

---

## 4ª aba no StudentLayout

Adicionar ao array `navItems`:

```ts
{ label: 'Jornada', path: '/aluno/jornada', Icon: MdAutoAwesome }
```

Rota em `router.tsx`:

```tsx
<Route path="/aluno/jornada" element={
  <AuthGuard requiredRole="student"><JourneyPage /></AuthGuard>
} />
```

---

## Fases de implementação

### Fase 1 — Base de dados e helpers (sem UI)

1. Executar SQL: criar `student_xp_events` + `student_achievements` + RLS + índices
2. Criar `src/lib/xpHelpers.ts` com `grantXp` e `checkAchievements`
3. Criar `src/hooks/useStudentProgress.ts` com toda a lógica de cálculo
4. Testar hook isoladamente com dados mock

### Fase 2 — Gatilhos de XP nas telas existentes

5. `TodayPage`: chamar `grantXp` ao marcar item como done
6. `TodayPage`: detectar missão diária completa → +20 XP
7. `PomodoroPage`: chamar `grantXp` ao salvar sessão
8. `RepertoirePage`: detectar `completion_pct = 100` → +300 XP + achievement

### Fase 3 — JourneyPage

9. Criar `src/pages/student/JourneyPage.tsx`
10. Adicionar 4ª aba no `StudentLayout`
11. Adicionar rota em `router.tsx`
12. Implementar todos os blocos da tela (região, streak, missões, atributos, conquistas)

### Fase 4 — Feedback visual

13. Toast de XP ao ganhar (toast customizado ou sonner com custom render)
14. Animação de progresso ao avançar de região
15. Toast de achievement ao desbloquear

---

## O que este sistema NÃO tem (intencionalmente)

- **Avatares ou itens de personagem** — complexidade visual desnecessária no MVP
- **Ranking entre alunos** — potencial de desmotivação, fora do escopo
- **XP por tempo de app aberto** — não mede resultado, gera comportamento errado
- **Missões criadas pelo professor** — possível em fase futura, mas não MVP
- **Mapa visual de jornada** — bonito mas não bloqueia valor; fase futura

---

## Arquivos a criar / modificar

### Criar
- `src/lib/xpHelpers.ts`
- `src/hooks/useStudentProgress.ts`
- `src/pages/student/JourneyPage.tsx`

### Modificar
- `src/pages/student/TodayPage.tsx` — adicionar chamadas de XP
- `src/pages/student/PomodoroPage.tsx` — adicionar chamada de XP na conclusão
- `src/pages/student/RepertoirePage.tsx` — detectar peça 100% para XP
- `src/components/layout/StudentLayout.tsx` — adicionar 4ª aba
- `src/router.tsx` — adicionar rota `/aluno/jornada`

### SQL (Supabase)
- `docs/schema_gamification.sql` — script completo para executar no Supabase

---

## Considerações de performance

- `student_xp_events` pode crescer rápido. O índice `(student_id, created_at DESC)` cobre a maioria das queries.
- `useStudentProgress` faz 3 queries: xp_events, achievements, study_sessions. Usar `Promise.all`.
- Streak é computado no frontend — sem query pesada, apenas `GROUP BY date`.
- Missões ativas fazem join em `pieces` e `programas` — já indexadas por `student_id` via `students.id`.
