-- ============================================================
-- ENTRE AULAS — Schema Update v2
-- Junho 2026
-- ============================================================
-- Executar no SQL Editor do Supabase (ordem corrigida)
-- ============================================================


-- ============================================================
-- 1. NOVO VALOR NO ENUM exercise_category
-- ============================================================

alter type exercise_category add value if not exists 'body_awareness';


-- ============================================================
-- 2. TABELA: student_plans
-- (criada antes de plan_items para permitir a foreign key)
-- ============================================================

create table if not exists student_plans (
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

create index if not exists idx_student_plans_student on student_plans(student_id);
create index if not exists idx_student_plans_active  on student_plans(is_active);

create trigger trg_student_plans_updated_at
  before update on student_plans
  for each row execute function fn_set_updated_at();


-- ============================================================
-- 3. TABELA: plan_repertoire
-- (criada antes de plan_items para permitir a foreign key)
-- ============================================================

create table if not exists plan_repertoire (
  id          uuid primary key default uuid_generate_v4(),
  plan_id     uuid not null references student_plans(id) on delete cascade,
  piece_id    uuid references pieces(id)    on delete cascade,
  exercise_id uuid references exercises(id) on delete cascade,
  priority    int2 not null default 0,
  created_at  timestamptz not null default now(),
  constraint chk_plan_repertoire_owner check (
    (piece_id is not null and exercise_id is null) or
    (piece_id is null    and exercise_id is not null)
  )
);

create index if not exists idx_plan_repertoire_plan     on plan_repertoire(plan_id);
create index if not exists idx_plan_repertoire_piece    on plan_repertoire(piece_id);
create index if not exists idx_plan_repertoire_exercise on plan_repertoire(exercise_id);


-- ============================================================
-- 4. NOVOS CAMPOS EM plan_items
-- (student_plans e plan_repertoire já existem agora)
-- ============================================================

alter table plan_items
  add column if not exists student_plan_id    uuid references student_plans(id)    on delete set null,
  add column if not exists plan_repertoire_id uuid references plan_repertoire(id)  on delete set null;


-- ============================================================
-- 5. TABELA: study_templates
-- ============================================================

create table if not exists study_templates (
  id         uuid primary key default uuid_generate_v4(),
  objective  text not null,
  item_type  text not null check (item_type in (
               'body_awareness', 'technique', 'new_piece', 'maintenance', 'other'
             )),
  label      text not null,
  percentage int2 not null check (percentage between 0 and 100),
  priority   int2 not null default 0
);

create index if not exists idx_study_templates_objective on study_templates(objective);


-- ============================================================
-- 6. DADOS INICIAIS — Templates de distribuição
-- ============================================================

-- Idempotente: limpa antes de reinserir
delete from study_templates;

insert into study_templates (objective, item_type, label, percentage, priority) values

  -- RECITAL / GRAVAR CD
  ('recital', 'body_awareness', 'Consciência corporal',    5, 1),
  ('recital', 'technique',      'Técnica e aquecimento',  10, 2),
  ('recital', 'new_piece',      'Peças do programa',      60, 3),
  ('recital', 'maintenance',    'Polimento e manutenção', 20, 4),
  ('recital', 'other',          'Percepção e teoria',      5, 5),

  -- MANUTENÇÃO / INTERMEDIÁRIO
  ('maintenance', 'body_awareness', 'Consciência corporal',   5, 1),
  ('maintenance', 'technique',      'Técnica e aquecimento', 20, 2),
  ('maintenance', 'new_piece',      'Peças novas',           45, 3),
  ('maintenance', 'maintenance',    'Manutenção',            25, 4),
  ('maintenance', 'other',          'Percepção e teoria',     5, 5),

  -- INICIANTE
  ('beginner', 'body_awareness', 'Consciência corporal',  10, 1),
  ('beginner', 'technique',      'Técnica e aquecimento', 30, 2),
  ('beginner', 'new_piece',      'Peça em andamento',     50, 3),
  ('beginner', 'other',          'Percepção e teoria',    10, 4);


-- ============================================================
-- 7. RLS — student_plans
-- ============================================================

alter table student_plans enable row level security;

create policy "Professor gerencia planos dos seus alunos"
  on student_plans for all
  using     (teacher_id = fn_my_teacher_id())
  with check (teacher_id = fn_my_teacher_id());

create policy "Aluno vê os próprios planos"
  on student_plans for select
  using (student_id = fn_my_student_id());


-- ============================================================
-- 8. RLS — plan_repertoire
-- ============================================================

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


-- ============================================================
-- 9. RLS — study_templates (leitura pública)
-- ============================================================

alter table study_templates enable row level security;

create policy "Leitura pública de templates"
  on study_templates for select
  using (true);


-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================

select 'student_plans'   as tabela, count(*) as registros from student_plans
union all
select 'plan_repertoire' as tabela, count(*) as registros from plan_repertoire
union all
select 'study_templates' as tabela, count(*) as registros from study_templates;

-- Resultado esperado:
-- student_plans   | 0
-- plan_repertoire | 0
-- study_templates | 14
