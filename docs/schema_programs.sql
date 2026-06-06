-- ============================================================
-- ENTRE AULAS — Schema: Programas e Planejamento de Estudos
-- Junho 2026
-- ============================================================
-- Executar no SQL Editor do Supabase.
-- Este script substitui o design anterior (student_plans,
-- plan_repertoire, study_templates, goals, concerts).
--
-- ATENÇÃO: apaga todos os dados de planejamento existentes.
-- ============================================================


-- ============================================================
-- 1. REMOVER COLUNAS ANTIGAS DE plan_items
--    (adicionadas por schema_v2.sql — não são mais usadas)
-- ============================================================

alter table plan_items
  drop column if exists student_plan_id,
  drop column if exists plan_repertoire_id,
  drop column if exists exercise_id;


-- ============================================================
-- 2. REMOVER TABELAS DO DESIGN ANTERIOR
-- ============================================================

drop table if exists plan_repertoire  cascade;
drop table if exists student_plans    cascade;
drop table if exists study_templates  cascade;
drop table if exists goals            cascade;
drop table if exists concerts         cascade;


-- ============================================================
-- 3. LIMPAR DADOS DE PLANEJAMENTO (start fresh)
-- ============================================================

delete from plan_items;
delete from weekly_plans;


-- ============================================================
-- 4. TABELA: programas
--    Substitui concerts. Dois comportamentos:
--    - type='regular': inclui todo o repertório ativo do aluno
--    - outros tipos:   professor vincula peças/exercícios
-- ============================================================

create table if not exists programas (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id)  on delete cascade,
  teacher_id   uuid not null references teachers(id),
  title        text not null,
  type         text not null default 'regular'
               check (type in (
                 'regular', 'recital', 'concerto', 'show',
                 'gravacao', 'exame', 'participacao', 'outro'
               )),
  deadline     date,
  venue        text,
  status       text not null default 'active'
               check (status in ('active', 'completed', 'archived')),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_programas_student on programas(student_id);
create index if not exists idx_programas_teacher on programas(teacher_id);
create index if not exists idx_programas_status  on programas(status);


-- ============================================================
-- 5. TABELA: program_pieces
--    Peças vinculadas a um programa (ignorada para type='regular')
-- ============================================================

create table if not exists program_pieces (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references programas(id) on delete cascade,
  piece_id          uuid not null references pieces(id)    on delete cascade,
  priority_override smallint check (priority_override between 1 and 10),
  created_at        timestamptz not null default now(),
  unique (program_id, piece_id)
);

create index if not exists idx_program_pieces_program on program_pieces(program_id);
create index if not exists idx_program_pieces_piece   on program_pieces(piece_id);


-- ============================================================
-- 6. TABELA: program_exercises
--    Exercícios vinculados a um programa
-- ============================================================

create table if not exists program_exercises (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references programas(id)   on delete cascade,
  exercise_id       uuid not null references exercises(id)   on delete cascade,
  priority_override smallint check (priority_override between 1 and 10),
  created_at        timestamptz not null default now(),
  unique (program_id, exercise_id)
);

create index if not exists idx_program_exercises_program  on program_exercises(program_id);
create index if not exists idx_program_exercises_exercise on program_exercises(exercise_id);


-- ============================================================
-- 7. TABELA: plan_programs
--    Registra quais programas (e com qual peso %) geraram
--    cada semana de planejamento. Permite regeneração futura.
-- ============================================================

create table if not exists plan_programs (
  id             uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  program_id     uuid not null references programas(id)    on delete cascade,
  weight         smallint not null default 100
                 check (weight between 1 and 100),
  unique (weekly_plan_id, program_id)
);

create index if not exists idx_plan_programs_plan    on plan_programs(weekly_plan_id);
create index if not exists idx_plan_programs_program on plan_programs(program_id);


-- ============================================================
-- 8. ALTERAR plan_items — novas colunas
-- ============================================================

alter table plan_items
  -- Tarefa normal: aponta para um item do checklist
  add column if not exists checklist_item_id uuid
    references checklist_items(id) on delete cascade,

  -- Programa de origem da tarefa (null = avulso manual)
  add column if not exists program_id uuid
    references programas(id) on delete set null,

  -- Tarefa de manutenção: piece_id já existe na tabela,
  -- apenas sinalizamos com esta flag
  add column if not exists is_maintenance boolean not null default false;

-- Regra semântica (não enforçada em DB, validada no app):
--   is_maintenance = false → checklist_item_id NOT NULL, piece_id NULL
--   is_maintenance = true  → piece_id NOT NULL, checklist_item_id NULL


-- ============================================================
-- 9. RLS — programas
-- ============================================================

alter table programas enable row level security;

create policy "Professor gerencia programas dos seus alunos"
  on programas for all
  using     (teacher_id = fn_my_teacher_id())
  with check (teacher_id = fn_my_teacher_id());

create policy "Aluno vê os próprios programas"
  on programas for select
  using (student_id = fn_my_student_id());


-- ============================================================
-- 10. RLS — program_pieces
-- ============================================================

alter table program_pieces enable row level security;

create policy "Professor gerencia peças dos programas"
  on program_pieces for all
  using (
    program_id in (
      select id from programas where teacher_id = fn_my_teacher_id()
    )
  )
  with check (
    program_id in (
      select id from programas where teacher_id = fn_my_teacher_id()
    )
  );

create policy "Aluno vê peças dos próprios programas"
  on program_pieces for select
  using (
    program_id in (
      select id from programas where student_id = fn_my_student_id()
    )
  );


-- ============================================================
-- 11. RLS — program_exercises
-- ============================================================

alter table program_exercises enable row level security;

create policy "Professor gerencia exercícios dos programas"
  on program_exercises for all
  using (
    program_id in (
      select id from programas where teacher_id = fn_my_teacher_id()
    )
  )
  with check (
    program_id in (
      select id from programas where teacher_id = fn_my_teacher_id()
    )
  );

create policy "Aluno vê exercícios dos próprios programas"
  on program_exercises for select
  using (
    program_id in (
      select id from programas where student_id = fn_my_student_id()
    )
  );


-- ============================================================
-- 12. RLS — plan_programs
-- ============================================================

alter table plan_programs enable row level security;

create policy "Professor gerencia plan_programs dos seus alunos"
  on plan_programs for all
  using (
    weekly_plan_id in (
      select wp.id from weekly_plans wp
      join students s on s.id = wp.student_id
      where s.teacher_id = fn_my_teacher_id()
    )
  )
  with check (
    weekly_plan_id in (
      select wp.id from weekly_plans wp
      join students s on s.id = wp.student_id
      where s.teacher_id = fn_my_teacher_id()
    )
  );

create policy "Aluno vê plan_programs próprios"
  on plan_programs for select
  using (
    weekly_plan_id in (
      select id from weekly_plans where student_id = fn_my_student_id()
    )
  );


-- ============================================================
-- VERIFICAÇÃO FINAL
-- Execute e confirme que todas as tabelas existem e estão vazias
-- ============================================================

select 'programas'        as tabela, count(*) as registros from programas
union all
select 'program_pieces'   as tabela, count(*) as registros from program_pieces
union all
select 'program_exercises'as tabela, count(*) as registros from program_exercises
union all
select 'plan_programs'    as tabela, count(*) as registros from plan_programs
union all
select 'plan_items'       as tabela, count(*) as registros from plan_items
union all
select 'weekly_plans'     as tabela, count(*) as registros from weekly_plans;

-- Resultado esperado:
-- programas         | 0
-- program_pieces    | 0
-- program_exercises | 0
-- plan_programs     | 0
-- plan_items        | 0
-- weekly_plans      | 0
