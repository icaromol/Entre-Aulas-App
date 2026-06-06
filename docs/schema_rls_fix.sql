-- ============================================================
-- RLS FIX — professor pode criar e gerenciar planejamentos
-- ============================================================
-- Problema: weekly_plans e plan_items só tinham políticas para
-- o próprio aluno. O professor precisa INSERT/DELETE para salvar
-- o planejamento gerado pela PlanejamentoPage.
-- ============================================================

-- 1. weekly_plans — professor pode SELECT e INSERT para seus alunos

drop policy if exists "teachers_select_weekly_plans" on weekly_plans;
create policy "teachers_select_weekly_plans" on weekly_plans
  for select
  using (
    student_id in (
      select id from students where teacher_id = fn_my_teacher_id()
    )
  );

drop policy if exists "teachers_insert_weekly_plans" on weekly_plans;
create policy "teachers_insert_weekly_plans" on weekly_plans
  for insert
  with check (
    student_id in (
      select id from students where teacher_id = fn_my_teacher_id()
    )
  );

drop policy if exists "teachers_delete_weekly_plans" on weekly_plans;
create policy "teachers_delete_weekly_plans" on weekly_plans
  for delete
  using (
    student_id in (
      select id from students where teacher_id = fn_my_teacher_id()
    )
  );

-- 2. plan_items — professor pode SELECT, INSERT e DELETE
--    (necessário para apagar o plano antigo antes de inserir o novo)

drop policy if exists "teachers_select_plan_items" on plan_items;
create policy "teachers_select_plan_items" on plan_items
  for select
  using (
    plan_id in (
      select wp.id from weekly_plans wp
      join students s on s.id = wp.student_id
      where s.teacher_id = fn_my_teacher_id()
    )
  );

drop policy if exists "teachers_insert_plan_items" on plan_items;
create policy "teachers_insert_plan_items" on plan_items
  for insert
  with check (
    plan_id in (
      select wp.id from weekly_plans wp
      join students s on s.id = wp.student_id
      where s.teacher_id = fn_my_teacher_id()
    )
  );

drop policy if exists "teachers_delete_plan_items" on plan_items;
create policy "teachers_delete_plan_items" on plan_items
  for delete
  using (
    plan_id in (
      select wp.id from weekly_plans wp
      join students s on s.id = wp.student_id
      where s.teacher_id = fn_my_teacher_id()
    )
  );

-- Verificação — deve listar as 6 novas políticas:
select policyname, tablename, cmd
from pg_policies
where tablename in ('weekly_plans', 'plan_items')
  and policyname like 'teachers_%'
order by tablename, cmd;
