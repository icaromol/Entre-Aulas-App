# Entre Aulas — Checklist Completo

> Última atualização: Junho 2026 (unificado com CHECKLIST.md — este é o documento autoritativo)

---

## Infraestrutura e Setup

- [x] Repositório GitHub criado e configurado
- [x] Projeto Vite + React + TypeScript
- [x] Tailwind CSS v4
- [x] shadcn/ui (radix-nova)
- [x] Supabase conectado
- [x] Schema SQL v1 importado (18 tabelas, RLS, triggers, funções auxiliares)
- [x] Documentação no repositório (PRODUCT_BRIEF, TECHNICAL_BRIEF, DEVELOPMENT_PLAN)
- [ ] Schema SQL v2 importado (student_plans, plan_repertoire, study_templates, body_awareness)
- [ ] Deploy no Vercel
- [ ] Supabase configurado para produção (email confirmado, RLS revisado)

---

## Autenticação

- [x] Login por e-mail e senha
- [x] Cadastro com role (professor / aluno)
- [x] Confirmação de senha
- [x] Redirecionamento por role
- [x] Rotas protegidas (AuthGuard)
- [x] Trigger criação automática de profiles e teachers
- [x] Fluxo de convite por link para aluno
- [x] Validação de e-mail duplicado
- [ ] Login com Google (OAuth)
- [ ] Recuperação de senha

---

## Layout e Navegação

- [x] Layout professor — header com nav
- [x] Layout professor — nav mobile
- [x] Layout aluno — bottom navigation (Hoje / Repertório / Metas / Histórico)
- [x] Links ativos destacados
- [x] Página 404
- [ ] Toast notifications global
- [ ] Loading states consistentes em todas as telas
- [ ] Empty states com ícone/ilustração em todas as telas

---

## Gestão de Alunos

- [x] Listagem de alunos com cards e ações rápidas (ir ao plano, editar)
- [x] Banner de convite após cadastro do aluno
- [x] Cadastro de aluno (nome, instrumento, nível, contato, disponibilidade)
- [x] Disponibilidade semanal (toggle por dia + minutos)
- [x] Perfil do aluno com tabs (Peças / Exercícios / Tarefas / Informações)
- [x] Cards de resumo no perfil (peças, exercícios, min/semana)
- [x] Edição de aluno
- [x] Exclusão de aluno com cascade
- [ ] Campo objetivo/plano visível no perfil
- [ ] Histórico de sessões visível no perfil do professor

---

## Planos de Estudo (novo módulo)

- [ ] SQL: tabela `student_plans`
- [ ] SQL: tabela `plan_repertoire`
- [ ] SQL: tabela `study_templates` com dados iniciais
- [ ] SQL: campo `body_awareness` no enum `exercise_category`
- [ ] SQL: campos `student_plan_id` e `plan_repertoire_id` em `plan_items`
- [ ] SQL: RLS para `student_plans` e `plan_repertoire`
- [ ] Tela: listagem de planos do aluno
- [ ] Tela: criação de plano (título, objetivo, prazo)
- [ ] Tela: detalhe do plano com repertório vinculado
- [ ] Ação: vincular peça existente ao plano
- [ ] Ação: vincular exercício existente ao plano
- [ ] Ação: remover item do plano
- [ ] Ação: encerrar / arquivar plano

---

## Algoritmo de Geração do Plano Semanal

- [ ] Função: calcular score de cada peça
  - [ ] Fator completion_pct (menos pronta = mais urgente)
  - [ ] Fator urgência de concerto (≤2sem / ≤4sem / ≤8sem)
  - [ ] Fator semanas sem aparecer (histórico de plan_items)
- [ ] Função: definir frequência por peça (5x / 3-4x / 1-2x por semana)
- [ ] Função: selecionar "peça da semana" (maior score)
- [ ] Função: distribuir itens por dia respeitando template
- [ ] Função: rotação semanal (rotation_offset por plano)
- [ ] Modal: preview do plano gerado
  - [ ] Visualização dia a dia
  - [ ] Destaque da peça da semana
  - [ ] Troca da peça do foco
  - [ ] Botão aprovar direto
  - [ ] Botão ajustar manualmente
- [ ] Integração: badge por plano no plano semanal (múltiplos planos)

---

## Repertório — Peças

- [x] Cadastro de peça completo (título, compositor, catálogo, período, dificuldade, objetivo, status)
- [x] Checklist editável durante a criação (adicionar/remover itens antes de salvar)
- [x] Checklist padrão gerada automaticamente (15 itens em 4 categorias)
- [x] Marcar / desmarcar itens da checklist
- [x] `completion_pct` calculado via trigger (itens opcionais fora do cálculo)
- [x] Adicionar item personalizado à checklist
- [x] Remover qualquer item da checklist
- [x] Atualizar status da peça (Em andamento / Concluída / Pausada / Futuro)
- [x] Barra de progresso na tela de detalhe
- [x] Progresso circular no card da listagem
- [x] Tela de edição de peça
- [x] Exclusão de peça
- [ ] Adicionar referências (YouTube / Spotify / URL)
- [ ] Anexar partitura PDF
- [ ] Histórico de comentários por peça (linha do tempo)

---

## Repertório — Exercícios

- [x] Cadastro de exercício completo (nome, categoria, objetivo, dificuldade, notas)
- [x] Checklist editável durante a criação (adicionar/remover itens antes de salvar)
- [x] Checklist padrão do exercício (5 itens)
- [x] Tela de detalhe do exercício com checklist interativa
- [x] Adicionar item personalizado à checklist
- [x] Remover qualquer item da checklist
- [x] Atualizar status do exercício
- [x] Edição de exercício
- [x] Exclusão de exercício
- [ ] Categoria consciência corporal (body_awareness) na UI

---

## Plano Semanal

- [x] Criação automática do plano ao acessar a semana
- [x] Scroll horizontal de dias com data (DD/MM)
- [x] Picker multi-seleção de itens por dia (com "Selecionar todos")
- [x] Distribuição automática de minutos ao adicionar itens
- [x] Controles +/- de minutos por item
- [x] Remover item do plano
- [x] Indicador de minutos planejados vs disponíveis
- [x] Alerta visual quando ultrapassa o tempo disponível
- [x] Navegação entre semanas
- [x] Copiar plano da semana anterior
- [x] Salvar plano
- [x] Botão "Plano personalizado" desabilitado (em breve)
- [ ] Integração com planos de estudo (badge por plano)
- [ ] Botão "Gerar semana automaticamente" (requer algoritmo)

---

## Hoje (Tela do Aluno)

- [x] Exibir itens do plano do dia em cards
- [x] Barra de progresso do dia (itens feitos / total)
- [x] Marcar item como feito sem pomodoro (checkbox)
- [x] Botão "Iniciar pomodoro" por item
- [x] Banner "Início rápido" sempre visível (inicia sessão livre no modo Clássico)
- [x] Mensagem de conclusão quando todos os itens estão feitos
- [x] Empty state com mensagem de estudo extra quando plano está vazio

---

## Pomodoro e Sessões

- [x] Cronômetro visual com fases trabalho / pausa curta / pausa longa
- [x] Seleção de ciclo: Iniciante / Clássico / Focado / Personalizado
- [x] Pausar e retomar sessão
- [x] Encerrar sessão antecipadamente
- [x] Tela de conclusão: selecionar itens trabalhados (checklist de peças/exercícios + metas ativas)
- [x] Tela de conclusão: adicionar comentários livres
- [x] Tela de conclusão: registrar dificuldade sentida (Fácil / Normal / Difícil)
- [x] Sessão livre sem vínculo com plano (autoStart via "Início rápido")
- [x] Salvar sessão: `study_sessions` + `checklist_completions` + `goals.status`
- [ ] Marcar itens da checklist durante a sessão (sem sair da tela)
- [ ] Exibir histórico de sessões na tela do pomodoro

---

## Metas (Tarefas)

- [x] Professor cria meta para o aluno (tipo, título, target_value, prazo, notas)
- [x] Vínculo com item de checklist
- [x] Vínculo com exercício
- [x] Parâmetro mensurável (target_value texto livre)
- [x] Prazo (due_date)
- [x] Edição de meta
- [x] Conclusão manual via UI (professor e aluno)
- [x] Conclusão automática via trigger quando item vinculado é marcado
- [x] Aluno visualiza metas ativas com tipo, prazo e target_value
- [x] Professor visualiza metas do aluno no perfil (aba Tarefas)
- [ ] Sugestão automática de metas ao vincular peça a concerto
  - [ ] Meta: "Andamento final alcançado" → prazo = data do concerto
  - [ ] Meta: "Pronta para performance" → prazo = 2 semanas antes

---

## Concertos e Recitais

- [ ] Professor cria concerto (nome, tipo, data, local)
- [ ] Vincular peças do repertório ao programa
- [ ] Contagem regressiva até o evento
- [ ] Status de preparo por peça (baseado em completion_pct)
- [ ] Alerta: peça abaixo do esperado X semanas antes
- [ ] Integração com algoritmo (concerto próximo = maior score)
- [ ] Aluno vê seus concertos

---

## Histórico e Evolução

- [ ] Professor vê log de sessões por aluno
  - [ ] Data, duração, ciclo usado
  - [ ] Itens trabalhados
  - [ ] Comentários e dificuldades
- [ ] Linha do tempo de comentários por peça
- [ ] Evolução do completion_pct ao longo do tempo (gráfico simples)
- [x] Aluno vê histórico próprio de sessões agrupado por semana
- [x] Tempo total estudado por semana
- [ ] Alimentação do algoritmo (score baseado em histórico real)

---

## Telas do Aluno (bottom nav)

- [x] Hoje — plano do dia com cards e pomodoro
- [x] Repertório — peças com progresso circular e checklist expansível; exercícios com categoria e status
- [x] Metas — metas ativas com tipo, prazo e target_value; concluídas em seção recolhível
- [x] Histórico — sessões agrupadas por semana com tempo total e dificuldade sentida

---

## Polimento de UX

- [ ] Toast notifications (salvar, marcar, excluir, erro)
- [ ] Loading states em todas as telas
- [ ] Empty states com ícone em todas as telas
- [x] Página 404
- [ ] Tratamento global de erros Supabase
- [ ] Responsividade revisada em todas as telas mobile
- [ ] Animações sutis (checklist tick, progresso, pomodoro)

---

## Deploy e Produção

- [ ] Variáveis de ambiente de produção configuradas
- [ ] Deploy no Vercel com CI/CD automático
- [ ] Confirmação de e-mail ativa no Supabase produção
- [ ] RLS revisado e testado em produção
- [ ] Domínio personalizado (opcional)

---

## Futuro (pós-MVP)

- [ ] Checklists específicas por instrumento
- [ ] Notificações push (lembrete de estudo)
- [ ] App mobile nativo (React Native)
- [ ] Integração Spotify/YouTube embutida
- [ ] Partitura PDF anexada à peça
- [ ] Peso por item de checklist
- [ ] Chat professor-aluno
- [ ] Exportação de relatório de progresso em PDF
- [ ] Multi-professor com workspaces separados
- [ ] Gráficos e dashboards avançados
- [ ] Login com Google

---

## Resumo de Progresso

| Módulo | Concluído | Total | % |
|---|---|---|---|
| Infraestrutura e setup | 7 | 10 | 70% |
| Autenticação | 8 | 10 | 80% |
| Layout e navegação | 5 | 8 | 63% |
| Gestão de alunos | 8 | 10 | 80% |
| Planos de estudo | 0 | 13 | 0% |
| Algoritmo de geração | 0 | 15 | 0% |
| Peças | 12 | 15 | 80% |
| Exercícios | 9 | 10 | 90% |
| Plano semanal | 12 | 14 | 86% |
| Hoje (aluno) | 7 | 7 | 100% |
| Pomodoro e sessões | 9 | 11 | 82% |
| Metas | 10 | 13 | 77% |
| Concertos e recitais | 0 | 7 | 0% |
| Histórico e evolução | 2 | 9 | 22% |
| Telas do aluno | 4 | 4 | 100% |
| Polimento de UX | 1 | 7 | 14% |
| Deploy e produção | 0 | 5 | 0% |
| **TOTAL** | **94** | **168** | **56%** |
