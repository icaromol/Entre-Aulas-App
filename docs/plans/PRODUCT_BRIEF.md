# Entre Aulas — Briefing Completo do Produto

> Versão 1.0 — Junho 2025
> Nome temporário: **Entre Aulas**

---

## 1. Visão Geral

O **Entre Aulas** é uma plataforma web responsiva de gestão pedagógica musical. Serve como ferramenta central para professores organizarem seus alunos, repertório, metas e planos de estudo — e para alunos acompanharem, registrarem e cronometrarem seu estudo diário de forma simples e eficiente.

### Proposta de valor

- **Professor:** visão completa do progresso de cada aluno, histórico detalhado e planejamento semanal inteligente
- **Aluno:** saber exatamente o que estudar hoje, registrar o que foi feito e manter consistência
- **Simplicidade acima de tudo:** rápido de usar, especialmente no celular

---

## 2. Perfis de Usuário

### Professor
Acesso completo ao sistema. Cria e gerencia alunos, repertório, exercícios, metas, planos semanais e concertos. Pode também ter um perfil de aluno de si mesmo — gerenciando seu próprio repertório e estudo com as mesmas ferramentas.

### Aluno
Acesso restrito ao próprio perfil. Visualiza o plano de estudo, usa o cronômetro/pomodoro, marca o que foi feito e registra comentários e dúvidas. Não edita repertório, checklist ou configurações — apenas consome e registra.

### Multi-professor (futuro)
A arquitetura já prevê múltiplos professores na plataforma. Cada professor gerencia apenas seus próprios alunos. Escalável via Row Level Security no Supabase.

---

## 3. Stack Técnica

| Camada | Tecnologia | Função |
|---|---|---|
| Frontend | React + Vite + TypeScript | Interface web responsiva |
| Estilo | Tailwind CSS v4 | Responsividade e design system |
| Componentes | shadcn/ui (radix-nova) | Componentes acessíveis e consistentes |
| Backend / Auth | Supabase | Auth, Banco Postgres, Storage, Realtime |
| Banco de dados | PostgreSQL (via Supabase) | Dados relacionais e seguros |
| Deploy | Vercel | Hospedagem frontend, CI/CD automático |

---

## 4. Identidade Visual

### Princípios de Design
- **Minimal** — nenhum elemento desnecessário na tela
- **Rápido** — o aluno deve conseguir iniciar um estudo em 2 toques
- **Claro** — hierarquia visual evidente, sem ambiguidade
- **Responsivo** — funciona perfeitamente em celular e desktop

### Paleta de Cores

| Papel | Hex |
|---|---|
| Primária (ações, destaques) | `#1E3A5F` |
| Secundária (links, elementos ativos) | `#4A90C4` |
| Background de seções | `#D6E4F0` |
| Fundo geral | `#FFFFFF` |
| Fundo de cards | `#F5F7FA` |
| Texto principal | `#111111` |
| Texto secundário | `#666666` |

### Tipografia
- Família: DM Sans, Nunito ou Plus Jakarta Sans (arredondada e moderna)
- Títulos: Bold, azul profundo `#1E3A5F`
- Corpo: Regular, preto `#111111`
- Labels: Medium, cinza `#666666`

---

## 5. Módulos do Sistema

### 5.1 Gestão de Alunos

**Cadastro do aluno:**
- Nome e sobrenome separados
- Instrumento, nível (Iniciante / Intermediário / Avançado)
- Contato (e-mail e telefone)
- Status (Ativo / Inativo / Concluído)
- Observações livres

**Disponibilidade semanal:**
- Toggle on/off por dia da semana (0=Dom … 6=Sáb)
- Minutos disponíveis por dia ativo
- Alimenta a distribuição automática do plano semanal

**Fluxo de convite:**
- Professor cadastra aluno com e-mail
- Sistema gera link: `/cadastro?invite=STUDENT_ID`
- Professor compartilha o link (WhatsApp, e-mail, etc.)
- Aluno acessa, cria senha, conta vincula automaticamente

---

### 5.2 Repertório — Peças

**Campos de cadastro:**
- Título, compositor, opus/catálogo
- Período histórico (Barroco / Clássico / Romântico / Moderno / Contemporâneo / Popular / Outro)
- Dificuldade (escala 1–10, slider)
- Objetivo pedagógico (Técnica / Performance / Leitura / Recital / Outro)
- Status (Em andamento / Concluída / Pausada / Repertório futuro)
- Referências (YouTube / Spotify / URL — futuro)
- Partitura PDF (futuro)
- Observações

**Checklist da peça:**
Gerada automaticamente ao criar a peça, editável pelo professor.

| Categoria | Item |
|---|---|
| Aprendizado inicial | Leitura das notas (voz/mão principal) |
| Aprendizado inicial | Leitura das notas (voz/mão secundária) |
| Aprendizado inicial | Leitura completa / mãos juntas |
| Aprendizado inicial | Definição de dedilhados / digitações |
| Desenvolvimento técnico | Trabalho rítmico em fragmentos |
| Desenvolvimento técnico | Trabalho em andamento lento |
| Desenvolvimento técnico | Trabalho por seções |
| Desenvolvimento técnico | Execução completa em andamento de estudo |
| Musicalidade | Análise de frases e respirações |
| Musicalidade | Dinâmicas aplicadas |
| Musicalidade | Caráter e estilo do período |
| Musicalidade | Peça inteira com expressão e intenção |
| Performance | Andamento final alcançado |
| Performance | Peça de memória *(opcional)* |
| Performance | Pronta para performance |

- Professor pode adicionar itens personalizados
- Itens opcionais **não entram** no cálculo de %
- `completion_pct` calculado automaticamente via trigger no banco

---

### 5.3 Exercícios

Itens de estudo recorrentes — técnica, percepção, harmonia, história, improvisação.

**Categorias:** Técnica / Percepção musical / Harmonia / História da música / Improvisação / Outro

**Checklist padrão do exercício:**
- Compreensão do conceito
- Execução lenta e consciente
- Execução em andamento de estudo
- Aplicação em contexto musical
- Execução em andamento final

---

### 5.4 Metas

Metas são objetivos específicos e mensuráveis com prazo.

**Tipos:**
- Ligada a item de checklist (conclusão automática via trigger)
- Ligada a exercício
- Parâmetro mensurável (BPM, %, dias) — `target_value` texto livre no MVP
- Livre / sem vínculo

**Campos:** título, tipo, vínculo, valor alvo, prazo, status, notas

---

### 5.5 Plano de Estudo Semanal

- Professor monta o plano com **drag and drop** entre colunas por dia
- Cada dia mostra minutos planejados vs disponíveis
- Botão `+` para adicionar itens do repertório
- Duração configurável por item
- Navegação entre semanas (anterior / próxima)
- Copiar plano da semana anterior
- Plano identificado por `week_start` (sempre segunda-feira)

**Visão do aluno:**
- Home com plano do dia em destaque
- Cards com nome, tipo, tempo sugerido
- Botão de iniciar pomodoro por item
- Checkbox para marcar sem pomodoro
- Barra de progresso do dia

---

### 5.6 Pomodoro e Sessões de Estudo

**Ciclos disponíveis:**

| Nome | Estudo | Pausa curta | Pausa longa | Ciclos |
|---|---|---|---|---|
| Iniciante | 20 min | 5 min | 10 min | 3 |
| Clássico | 25 min | 5 min | 15 min | 4 |
| Focado | 50 min | 10 min | 20 min | 2 |
| Personalizado | livre | livre | livre | livre |

**Fluxo da sessão:**
1. Aluno seleciona o ciclo
2. Inicia o cronômetro (vinculado a item do plano ou livre)
3. Durante o estudo: pode marcar itens da checklist sem sair da tela
4. Ao encerrar: seleciona o que foi trabalhado (1 ou mais itens)
5. Adiciona comentários (dificuldades, dúvidas)
6. Sessão salva automaticamente

**Campos registrados por sessão:**
- Data/hora, duração total, ciclo utilizado
- Itens trabalhados, comentários, itens de checklist marcados
- `difficulty_felt`: easy / ok / hard (opcional)

---

### 5.7 Concertos e Recitais

**Campos:** nome, tipo, data, local, peças do programa, status

**Gerado automaticamente:**
- Contagem regressiva até o evento
- Status de preparo por peça (baseado na checklist)
- Alerta quando peça do programa está abaixo do esperado
- Prioridade automática no plano semanal

---

### 5.8 Histórico e Evolução

- Linha do tempo de comentários por peça/exercício
- Log de sessões com duração e itens
- Evolução da % de conclusão das peças
- Tempo total estudado por semana/mês
- Comparativo de metas criadas vs concluídas

---

## 6. Casos de Uso Principais

| ID | Caso de uso | Quem | Frequência |
|---|---|---|---|
| CU-01 | Cadastrar aluno | Professor | Esporádico |
| CU-02 | Montar repertório do aluno | Professor | Esporádico |
| CU-03 | Atualizar progresso pós-aula | Professor | Semanal |
| CU-04 | Criar meta para o aluno | Professor | Quinzenal |
| CU-05 | Montar plano semanal | Professor | Semanal |
| CU-06 | Revisar histórico do aluno | Professor | Semanal |
| CU-07 | Ver plano do dia | Aluno | Diária |
| CU-08 | Iniciar sessão pelo plano | Aluno | Diária |
| CU-09 | Iniciar sessão livre | Aluno | Diária |
| CU-10 | Registrar sessão ao encerrar | Aluno | Diária |
| CU-11 | Marcar item sem cronômetro | Aluno | Diária |
| CU-12 | Ver metas ativas | Aluno | Semanal |
| CU-13 | Criar/editar concerto | Professor | Esporádico |
| CU-14 | Ciclo completo aula→estudo→aula | Professor + Aluno | Semanal |

---

## 7. Modelo de Dados — Tabelas

```
IDENTIDADE
  profiles           → usuários (auth Supabase), first_name, last_name, role
  teachers           → dados do professor, ligado ao profile
  students           → dados do aluno, ligado ao profile (nullable) e ao teacher

DISPONIBILIDADE
  student_availability → day_of_week, is_active, minutes_available

REPERTÓRIO
  pieces             → peças com completion_pct calculado por trigger
  piece_references   → links YouTube/Spotify/URL por peça
  exercises          → exercícios técnicos/teóricos
  checklist_items    → itens de checklist (piece_id OU exercise_id)
  checklist_completions → registro de conclusão por aluno

METAS
  goals              → metas com vínculo opcional a checklist_item ou exercise

PLANO SEMANAL
  weekly_plans       → plano por semana (week_start = segunda-feira)
  plan_items         → itens do plano com day_of_week, duration_minutes, is_done

SESSÕES
  study_sessions     → sessões de estudo com dados do ciclo pomodoro
  session_items      → itens trabalhados por sessão
  session_checklist_marks → itens marcados durante a sessão

CONCERTOS
  concerts           → eventos de performance
  concert_pieces     → peças do programa (N:N)

HISTÓRICO
  comments           → comentários professor/aluno por peça, exercício ou sessão
```

**Total: 18 tabelas**

### Triggers implementados

| Trigger | Dispara em | Ação |
|---|---|---|
| `trg_update_completion_pct` | INSERT/DELETE em `checklist_completions` | Recalcula `pieces.completion_pct` |
| `trg_goal_auto_complete` | INSERT em `checklist_completions` | Marca meta como concluída |
| `trg_session_mark_to_completion` | INSERT em `session_checklist_marks` | Cria registro em `checklist_completions` |
| `trg_on_auth_user_created` | INSERT em `auth.users` | Cria `profiles` automaticamente |
| `trg_on_profile_created` | INSERT em `profiles` | Cria `teachers` se role = teacher |
| `trg_*_updated_at` | UPDATE em qualquer tabela | Atualiza `updated_at` automaticamente |

### RLS (Row Level Security)
- Todas as 18 tabelas com RLS habilitado
- Professor vê e edita apenas dados dos próprios alunos
- Aluno vê e edita apenas o próprio perfil, sessões e marcações
- Funções auxiliares: `fn_my_teacher_id()`, `fn_my_student_id()`, `fn_is_my_student()`

---

## 8. Navegação

### Professor (Header + nav)
- `/professor/alunos` — lista de alunos
- `/professor/alunos/novo` — cadastrar aluno
- `/professor/alunos/:id` — perfil do aluno (tabs: Peças / Exercícios / Informações)
- `/professor/alunos/:id/editar` — editar dados do aluno
- `/professor/alunos/:id/pecas/nova` — nova peça
- `/professor/alunos/:id/pecas/:pieceId` — detalhe da peça + checklist
- `/professor/alunos/:id/exercicios/novo` — novo exercício
- `/professor/alunos/:id/plano` — plano semanal com drag and drop

### Aluno (Bottom navigation: Hoje / Repertório / Metas / Histórico)
- `/aluno/hoje` — plano do dia com cards e pomodoro
- `/aluno/pomodoro` — cronômetro *(em construção)*
- `/aluno/repertorio` — peças e exercícios *(em construção)*
- `/aluno/metas` — metas ativas *(em construção)*
- `/aluno/historico` — sessões passadas *(em construção)*

---

## 9. Decisões Técnicas Relevantes

- **`completion_pct` calculado no banco** via trigger — não no frontend
- **Itens opcionais não entram no cálculo** de porcentagem
- **`invite_token`** gerado automaticamente para cada aluno — link de convite sem necessidade de backend
- **Ciclo pomodoro salvo na sessão** — `cycle_work_minutes` etc. ficam no registro para preservar histórico correto mesmo se o ciclo mudar
- **`week_start` sempre segunda-feira** — identifica o plano da semana de forma canônica
- **Drag and drop** com `@dnd-kit` — `handleDragOver` cuida da mudança de dia, `handleDragEnd` da reordenação
- **Leitura pública de `students` por ID** habilitada via RLS para o fluxo de convite

---

## 10. Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

---

## 11. Repositório

- **GitHub:** https://github.com/icaromol/Entre-Aulas-App
- **Supabase:** https://supabase.com/dashboard/project/gdyvazyqisigvbhnsxui
