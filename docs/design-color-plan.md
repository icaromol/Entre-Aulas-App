# Plano de Cores por Página — estudamus (aluno)

> Documento de referência para aplicação de cores. Fase atual: só cores (sem formas abstratas ainda).
> Data: 2026-06-12

---

## Paleta oficial

| Token         | Hex       | Nome           | Papel                              |
|---------------|-----------|----------------|------------------------------------|
| `tomato`      | `#ff4c3e` | Tomato         | Vermelho principal — design e CTAs |
| `yale`        | `#153b50` | Yale Blue      | Azul escuro principal              |
| `frosted`     | `#b2f0fb` | Frosted Blue   | Azul claro — apoio e badges        |
| `lavender`    | `#ffeceb` | Lavender Blush | Fundo suave do Tomato              |
| `aliceBlue`   | `#eff7fb` | Alice Blue     | Fundo suave do Yale Blue           |
| `azureMist`   | `#ecfbfe` | Azure Mist     | Fundo suave do ciano               |
| `whiteSmoke`  | `#f5f5f5` | White Smoke    | Fundo neutro de página             |
| `alabaster`   | `#e5e5e5` | Alabaster Grey | Bordas, divisores, cards secundários |
| `pureRed`     | `#f50c00` | Pure Red       | Hover escuro do Tomato             |
| `cerulean`    | `#297aa3` | Cerulean       | Hover do Yale Blue                 |
| `pacificCyan` | `#0993ae` | Pacific Cyan   | Azul saturado (botões secundários) |
| `graphite`    | `#292929` | Graphite       | Texto e ícones                     |
| `white`       | `#ffffff` | White          | Branco puro                        |

### Regra de alternância de cores por seção de nav

O Tomato (`#ff4c3e`) e o Yale Blue (`#153b50`) são as duas cores primárias do app.
Cada grupo de páginas "herda" uma cor como sua primária — refletida na top bar, bottom nav e elementos principais.

| Grupo de páginas            | Cor primária (top bar / nav) |
|-----------------------------|------------------------------|
| Planejamento (hoje)         | **Tomato** `#ff4c3e`         |
| Repertório e subrotas       | **Yale Blue** `#153b50`      |
| Objetivos                   | **Yale Blue** `#153b50`      |
| Jornada                     | **Yale Blue** `#153b50`      |
| Pomodoro (foco)             | **Yale Blue** `#153b50`      |
| Histórico                   | **Yale Blue** `#153b50`      |

---

## Conceito global

- **Fundo de página**: sempre `#f5f5f5` (White Smoke) — neutro, não compete com os acentos.
- **Cards**: `#f5f5f5` com `shadow-[0_1px_4px_rgba(0,0,0,0.06)]` sem borda — leve e limpo.
- **Cards secundários / estado inativo**: `#e5e5e5` (Alabaster Grey) — para distinguir sem usar cor.
- **Frosted Blue** (`#b2f0fb`): sempre como apoio — em badges suaves (`/20`), barras de progresso, bordas hover.
- **Lavender Blush** (`#ffeceb`): fundo suave dos itens relacionados ao Tomato (estado de destaque suave nas páginas de Planejamento).
- **Texto primário**: `#292929` (Graphite) ou `#153b50` (Yale Blue) para títulos de seção.
- **Ícones de menu**: `#292929` — nunca coloridos, exceto o ícone destrutivo que usa Tomato.

---

## Página a página

---

### `/aluno/planejamento` — Planejamento do dia (TodayPage)

**Conceito:** Energia e ação. O aluno abre essa tela todo dia para ver o que vai estudar. O Tomato cria urgência positiva — "hora de estudar". É a tela mais emocional.

**Cor primária:** Tomato `#ff4c3e`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Top bar                         | `#ff4c3e`                                    |
| Bottom nav                      | `#ff4c3e`                                    |
| Número do dia (enorme)          | `#ff4c3e`                                    |
| Nome do dia por extenso         | `#ff4c3e`                                    |
| Chevrons de navegação (hover)   | `#ff4c3e`                                    |
| Ícone de check dos itens feitos | `#ff4c3e`                                    |
| Banner "Início rápido"          | `bg-[#ff4c3e]`                               |
| Botão play (por tarefa)         | `bg-[#ff4c3e]` hover `#f50c00`              |
| Barra de progresso da tarefa    | `bg-[#b2f0fb]` (Frosted Blue — apoio)        |
| Fundo do card de tarefa         | `bg-[#f5f5f5]`                               |
| Fundo card tarefa concluída     | `bg-[#ffeceb]` (Lavender Blush — suave)      |
| Badge do programa               | `bg-[#ffeceb] text-[#ff4c3e]`               |
| Botões de ação (timer, balancear) | `bg-[#f5f5f5]` icon Tomato, hover bg `#b2f0fb` |
| Tabs (peças/exercícios) ativa   | `bg-[#ff4c3e] text-white`                    |
| Tabs inativa                    | `bg-[#ffeceb]/60 text-[#ff4c3e]/60`         |
| Empty state (ícone)             | `bg-[#ff4c3e]`                               |
| Modais — botão confirmar        | `bg-[#ff4c3e]` hover `#f50c00`              |
| Fundo modal                     | branco                                       |

**Regra de apoio:** Frosted Blue (`#b2f0fb`) nas barras de progresso e hover dos botões laterais. Lavender Blush (`#ffeceb`) como fundo suave de destaque (itens concluídos, badges).

---

### `/aluno/pomodoro` — Cronômetro Pomodoro (PomodoroPage)

**Conceito:** Foco e concentração. O aluno entra aqui para estudar de verdade — precisa de silêncio visual. Yale Blue transmite seriedade e profundidade. O cronômetro é o protagonista absoluto.

**Cor primária:** Yale Blue `#153b50`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Top bar                         | `#153b50`                                    |
| Bottom nav                      | `#153b50`                                    |
| Fundo de página                 | `#f5f5f5`                                    |
| Número do cronômetro            | `#153b50` (grande, bold)                     |
| Arco de progresso do timer      | `#153b50` (traço), `#e5e5e5` (trilha)        |
| Botão play/pause principal      | `bg-[#153b50]` hover `#297aa3`              |
| Ciclos de estudo (dots)         | ativo `#153b50`, feito `#b2f0fb`, vazio `#e5e5e5` |
| Label fase (FOCO / DESCANSO)    | foco `text-[#153b50]`, descanso `text-[#b2f0fb]` |
| Seleção de ciclo (Clássico etc) | ativo `bg-[#153b50] text-white`, inativo `bg-[#e5e5e5]` |
| Checklist de itens              | check `#153b50`, borda pendente `#b2f0fb`    |
| Botão finalizar sessão          | `bg-[#153b50]` hover `#297aa3`              |
| Dificuldade (emoji fácil/ok/difícil) | botão ativo `bg-[#153b50]`              |
| Badge de dificuldade            | fácil `#b2f0fb/20 + #153b50`, difícil `#ffeceb + #ff4c3e` |
| Fundo durante descanso          | fundo leve `#eff7fb` (Alice Blue)            |

**Regra de apoio:** Frosted Blue (`#b2f0fb`) como trilha do timer e ciclos concluídos. Alice Blue (`#eff7fb`) no fundo durante a fase de descanso — sutil mudança de clima.

---

### `/aluno/repertorio` — Repertório (RepertoirePage)

**Conceito:** Biblioteca musical. O aluno consulta suas peças e exercícios. Yale Blue traz autoridade e organização — a sensação de uma biblioteca bem catalogada.

**Cor primária:** Yale Blue `#153b50`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Top bar                         | `#153b50`                                    |
| Bottom nav                      | `#153b50`                                    |
| Título "Repertório"             | `text-[#153b50]`                             |
| Tab ativa (Peças/Exercícios)    | `bg-[#153b50] text-white`                    |
| Tab inativa                     | `bg-[#b2f0fb]/20 text-[#153b50]/60`         |
| Fundo dos cards                 | `bg-[#f5f5f5]`                               |
| Progress ring — trilha          | `#b2f0fb` opacity 30%                        |
| Progress ring — arco em andamento | `#153b50`                                  |
| Progress ring — arco concluído  | `#0993ae` (Pacific Cyan)                     |
| Progress ring — pausada         | `#e5e5e5`                                    |
| Badge "Em andamento"            | `bg-[#eff7fb] text-[#153b50]`               |
| Badge "Concluída"               | `bg-[#ecfbfe] text-[#0993ae]`               |
| Badge "Pausada"                 | `bg-[#e5e5e5] text-[#292929]`               |
| Badge categoria exercício       | `bg-[#b2f0fb]/20 text-[#153b50]`            |
| Checklist check filled          | `#153b50`                                    |
| Checklist borda pendente        | `#b2f0fb`                                    |
| Switch ativo                    | `#153b50`                                    |
| Botão "Nova peça / Exercício"   | `bg-[#153b50]` hover `#297aa3`              |
| Seleção múltipla — highlight    | `bg-[#eff7fb] ring-2 ring-[#153b50]`         |
| Modais — confirmar              | `bg-[#153b50]` hover `#297aa3`              |

---

### `/aluno/repertorio/pecas/:id` — Detalhe da peça (PieceDetailPage)

**Conceito:** Foco em uma peça específica. Yale Blue como cor central — dá peso ao item musical. O checklist mostra a evolução técnica.

**Cor primária:** Yale Blue `#153b50`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Top bar / nav                   | `#153b50`                                    |
| Título da peça                  | `text-[#153b50]`                             |
| Percentual de conclusão         | `text-[#153b50]`                             |
| Barra de progresso              | `bg-[#153b50]` (preenchimento) / `#e5e5e5` (trilha) |
| Tab ativa (Checklist/Info)      | `bg-white text-[#153b50] shadow-sm`          |
| Checklist — item concluído      | `bg-[#153b50] border-[#153b50]` + check branco |
| Checklist — item pendente       | `border-[#b2f0fb]`                           |
| Botão editar (link)             | hover `text-[#153b50]`                       |
| Badge de status                 | igual à RepertoirePage                       |

---

### `/aluno/repertorio/exercicios/:id` — Detalhe do exercício (ExerciseDetailPage)

**Conceito:** Análogo à peça, mas para exercícios técnicos. Mesma linguagem visual — Yale Blue e Frosted Blue.

**Cor primária:** Yale Blue `#153b50`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Top bar / nav                   | `#153b50`                                    |
| Título                          | `text-[#153b50]`                             |
| Barra de progresso              | `bg-[#b2f0fb]` (Frosted Blue)               |
| Checklist concluído             | `bg-[#153b50] border-[#153b50]`             |
| Checklist hover pendente        | `hover:border-[#b2f0fb]`                    |

---

### `/aluno/repertorio/programas/:id` — Detalhe do programa

**Conceito:** Visão de contexto — onde a peça/exercício se encaixa. Yale Blue como âncora visual de planejamento mais estruturado.

**Cor primária:** Yale Blue `#153b50`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Header do programa              | `bg-[#153b50]`                               |
| Título                          | `text-[#153b50]`                             |
| Ícone do tipo                   | `bg-[#153b50]`                               |
| Badge de progresso              | `text-[#b2f0fb]`                             |

---

### `/aluno/objetivos` — Objetivos (ObjetivosPage)

**Conceito:** Visão de futuro e motivação. O aluno define metas — cartas de intenção musical. Yale Blue transmite solidez e comprometimento.

**Cor primária:** Yale Blue `#153b50`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Top bar / nav                   | `#153b50`                                    |
| Título "Objetivos"              | `text-[#153b50]`                             |
| Ícone empty state               | `bg-[#153b50]`                               |
| Header do card de objetivo      | `bg-[#153b50]`                               |
| Botão "Novo objetivo"           | `bg-[#153b50]` hover `#297aa3`              |
| Cards de seleção (tipo)         | inativo `bg-[#f5f5f5]`, hover/ativo `bg-[#153b50] text-white` |
| Ícone hover em cards            | muda de `text-[#292929]` para `text-white`   |
| Links internos (Todas, Todos)   | `text-[#b2f0fb]`                             |
| Botão salvar modal              | `bg-[#153b50]`                               |

---

### `/aluno/jornada` — Jornada Musical (JourneyPage)

**Conceito:** Gamificação e evolução — rank, streak, missões, XP. Yale Blue como cor de progressão e conquista. Frosted Blue para os elementos de progresso e XP.

**Cor primária:** Yale Blue `#153b50`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Top bar / nav                   | `#153b50`                                    |
| Título "Jornada Musical"        | `text-[#153b50]`                             |
| Rank atual                      | `text-[#153b50]` bold                        |
| Barra de XP (progresso)         | `bg-[#b2f0fb]` → `bg-[#153b50]` ao completar |
| Streak (dias seguidos)          | `text-[#153b50]` bold                        |
| Card próximo evento             | `bg-[#f5f5f5]`, ícone `text-[#153b50]`      |
| Missão do dia — progresso       | `bg-[#b2f0fb]`                               |
| Missão concluída — progresso    | `bg-[#153b50]`                               |
| Dots de onboarding              | ativo `bg-[#153b50]`, inativo `bg-[#e5e5e5]` |
| XP por conquista                | `text-[#b2f0fb] font-bold`                  |
| Botão continuar onboarding      | `bg-[#153b50]`                               |
| Ícone em cards de conquista     | `bg-[#f5f5f5]`, ativo `bg-[#153b50]`        |

---

### `/aluno/historico` — Histórico de sessões (HistoryPage)

**Conceito:** Retrospectiva e consciência. O aluno vê o que estudou ao longo do tempo. Yale Blue para seriedade e retrospectiva. Frosted Blue para os destaques de tempo.

**Cor primária:** Yale Blue `#153b50`

| Elemento                        | Cor aplicada                                 |
|---------------------------------|----------------------------------------------|
| Top bar / nav                   | `#153b50`                                    |
| Título "Histórico"              | `text-[#153b50]`                             |
| Card "Esta semana"              | `bg-[#f5f5f5]`                               |
| Ícone do card semanal           | `bg-[#153b50]`                               |
| Label "Esta semana"             | `text-[#b2f0fb]`                             |
| Total de minutos semanais       | `text-[#153b50]` bold                        |
| Badge de duração por sessão     | `bg-[#f5f5f5] text-[#153b50]`               |
| Badge de dificuldade            | fácil `#eff7fb + #153b50`, ok `#e5e5e5 + #292929`, difícil `#ffeceb + #ff4c3e` |
| Itens trabalhados               | `bg-[#f5f5f5] text-[#153b50]`               |
| Empty state ícone               | `bg-[#153b50]`                               |

**Nota sobre badge de dificuldade:** o "difícil" usa Tomato (`#ff4c3e`) como indicador de esforço — não é destrutivo, é informativo. Consistente com o significado emocional do Tomato.

---

### `/aluno/pomodoro` fases — variação de clima

A PomodoroPage é a única que muda o **clima visual** durante o uso — não a top bar, mas o fundo da página:

| Fase          | Fundo de página | Clima                        |
|---------------|-----------------|------------------------------|
| Foco          | `#f5f5f5`       | Neutro e concentrado         |
| Descanso      | `#eff7fb`       | Alice Blue — leveza e pausa  |
| Tela de conclusão | `#f5f5f5`   | Volta ao neutro              |

---

## Resumo da identidade por página

| Página              | Cor nav | Cor principal conteúdo | Apoio principal         |
|---------------------|---------|------------------------|-------------------------|
| Planejamento (hoje) | Tomato  | Tomato                 | Frosted Blue, Lavender  |
| Pomodoro            | Yale    | Yale Blue              | Frosted Blue, Alice     |
| Repertório          | Yale    | Yale Blue              | Frosted Blue, Azure     |
| Peça / Exercício    | Yale    | Yale Blue              | Frosted Blue            |
| Objetivos           | Yale    | Yale Blue              | Frosted Blue            |
| Jornada             | Yale    | Yale Blue              | Frosted Blue            |
| Histórico           | Yale    | Yale Blue              | Frosted Blue, Alabaster |

**O Tomato aparece como conteúdo em:** badge "difícil" (HistoryPage), ações destrutivas confirmadas (modal), e qualquer elemento de urgência/esforço máximo.

---

## Próximos passos (Fase 2 — formas abstratas)

- Formas geométricas abstratas no fundo das páginas principais (planejamento e repertório)
- Gradientes suaves nos headers de seção
- Ilustrações minimalistas nos empty states
- Micro-animações de transição de cor ao mudar de página

---

*Referência de implementação: `src/lib/colors.ts` — `COLORS.tomato`, `COLORS.yale`, `COLORS.frosted`, etc.*
