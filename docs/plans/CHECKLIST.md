# Entre Aulas — Checklist do Projeto

> Última atualização: Junho 2025

---

## Planejamento e Infraestrutura

- [x] Idealização completa do produto
- [x] Casos de uso mapeados (14 casos)
- [x] Modelo de dados aprovado (18 tabelas)
- [x] Briefing completo documentado
- [x] Stack técnica definida (React + Vite + TS + Tailwind + shadcn + Supabase)
- [x] Repositório GitHub criado e configurado
- [x] Projeto Vite + React + TypeScript inicializado
- [x] Tailwind CSS v4 instalado e configurado
- [x] shadcn/ui configurado (preset: radix-nova)
- [x] Supabase conectado e respondendo
- [x] Schema SQL completo importado no Supabase
- [x] RLS habilitado em todas as 18 tabelas

---

## Autenticação

- [x] Login por e-mail e senha
- [x] Cadastro com seleção de role (professor / aluno)
- [x] Confirmação de senha no cadastro
- [x] Redirecionamento automático por role após login
- [x] Rotas protegidas com `AuthGuard`
- [x] Trigger de criação automática de `profiles` no signup
- [x] Trigger de criação automática de `teachers` quando role = teacher
- [x] Fluxo de convite por link para aluno (`?invite=STUDENT_ID`)
- [x] Cadastro do aluno via link vincula `profile_id` automaticamente
- [x] Validação de e-mail duplicado ao cadastrar aluno

---

## Layout e Navegação

- [x] Layout do professor — header com nav (Alunos / Agenda)
- [x] Nav mobile do professor (segunda linha no header)
- [x] Layout do aluno — bottom navigation (Hoje / Repertório / Metas / Histórico)
- [x] Header do aluno com nome e botão de sair
- [x] Links ativos destacados em ambos os layouts

---

## Gestão de Alunos

- [x] Listagem de alunos ativos com avatar de iniciais
- [x] Banner de convite após cadastrar aluno
- [x] Cadastro de aluno (nome, sobrenome, instrumento, nível, contato)
- [x] Disponibilidade semanal — toggle por dia + minutos por dia ativo
- [x] Perfil do aluno com tabs (Peças / Exercícios / Informações)
- [x] Cards de resumo no perfil (peças, exercícios, min/semana)
- [x] Edição de aluno com disponibilidade semanal
- [x] Exclusão de aluno com confirmação (cascade no banco)
- [x] Botão de acesso ao plano semanal no perfil

---

## Repertório — Peças

- [x] Cadastro de peça (título, compositor, catálogo, período, dificuldade, objetivo, status)
- [x] Checklist padrão gerada automaticamente (15 itens em 4 categorias)
- [x] Preview da checklist antes de criar
- [x] Marcar / desmarcar itens da checklist
- [x] `completion_pct` calculado automaticamente via trigger no banco
- [x] Itens opcionais não entram no cálculo de %
- [x] Adicionar item personalizado à checklist
- [x] Remover item personalizado
- [x] Agrupamento por categoria na visualização
- [x] Atualizar status da peça (Em andamento / Concluída / Pausada / Futuro)
- [x] Barra de progresso na peça
- [x] Progresso circular no card da lista
- [ ] Adicionar referências (YouTube / Spotify / URL)
- [ ] Anexar partitura PDF
- [ ] Checklist específica por instrumento

---

## Exercícios

- [x] Cadastro de exercício (nome, categoria, objetivo, dificuldade)
- [x] Seleção de categoria com grid de botões
- [x] Checklist padrão do exercício (5 itens)
- [ ] Tela de detalhe do exercício
- [ ] Edição de exercício
- [ ] Exclusão de exercício

---

## Plano de Estudo Semanal

- [x] Criação automática do plano ao acessar a semana
- [x] Grid de colunas por dia (apenas dias ativos)
- [x] Drag and drop de itens entre dias
- [x] Reordenação dentro do mesmo dia
- [x] Adicionar item do repertório ao dia (picker)
- [x] Remover item do plano
- [x] Configurar duração por item (input inline)
- [x] Indicador de minutos planejados vs disponíveis
- [x] Alerta visual quando ultrapassa o tempo disponível
- [x] Navegação entre semanas (anterior / próxima)
- [x] Copiar plano da semana anterior
- [x] Salvar plano (delete + reinsert com posições)
- [x] Aluno vê plano do dia em cards
- [x] Barra de progresso do dia (itens feitos / total)
- [x] Marcar item como feito sem pomodoro (checkbox)
- [x] Botão "Iniciar pomodoro" por item
- [x] Mensagem de conclusão quando todos os itens estão feitos
- [ ] Distribuição automática por disponibilidade

---

## Pomodoro e Sessões

- [ ] Tela do pomodoro com cronômetro
- [ ] Ciclos selecionáveis: Iniciante, Clássico, Focado, Personalizado
- [ ] Pausar e retomar sessão
- [ ] Encerrar sessão
- [ ] Selecionar itens trabalhados ao encerrar
- [ ] Adicionar comentários e dificuldades (`difficulty_felt`)
- [ ] Marcar itens da checklist durante a sessão
- [ ] Salvar sessão em `study_sessions` + `session_items`
- [ ] Atualizar `is_done` do item do plano ao encerrar
- [ ] Sessão livre (sem vínculo com plano)

---

## Metas

- [ ] Professor cria meta para o aluno
- [ ] Vínculo com item de checklist
- [ ] Vínculo com exercício
- [ ] Parâmetro mensurável (`target_value`)
- [ ] Prazo (data)
- [ ] Conclusão automática via trigger quando item vinculado é marcado
- [ ] Aluno visualiza metas ativas
- [ ] Tela de metas no bottom nav do aluno

---

## Concertos e Recitais

- [ ] Professor cria concerto (nome, tipo, data, local)
- [ ] Vincular peças do repertório ao programa
- [ ] Contagem regressiva até o evento
- [ ] Status de preparo por peça do programa
- [ ] Alerta de peças abaixo do esperado

---

## Histórico

- [ ] Professor vê log de sessões por aluno
- [ ] Linha do tempo de comentários por peça
- [ ] Aluno vê histórico próprio de sessões
- [ ] Tempo total estudado por semana
- [ ] Evolução da % de conclusão das peças

---

## Polimento de UX

- [ ] Toast notifications (feedback de ações como salvar, marcar, excluir)
- [ ] Estados de loading consistentes em todas as telas
- [ ] Empty states com ilustração/ícone
- [ ] Página 404
- [ ] Tratamento global de erros
- [ ] Responsividade mobile revisada em todas as telas
- [ ] Tela de detalhe de exercício para o aluno
- [ ] Tela de repertório completo do aluno (bottom nav)

---

## Deploy

- [ ] Variáveis de ambiente de produção configuradas
- [ ] Deploy no Vercel
- [ ] Supabase com confirmação de e-mail ativa (produção)
- [ ] RLS revisado para produção
- [ ] Domínio personalizado (opcional)

---

## Futuro (pós-MVP)

- [ ] Gráficos e dashboards de evolução
- [ ] Checklists específicas por instrumento
- [ ] Notificações e lembretes push
- [ ] Múltiplos professores com workspaces separados
- [ ] App mobile nativo (React Native)
- [ ] Integração com Spotify e YouTube embutida
- [ ] Peso por item de checklist no cálculo de %
- [ ] Chat professor-aluno
- [ ] Exportação de relatório de progresso em PDF
- [ ] Login com Google (OAuth configurado no Supabase)
