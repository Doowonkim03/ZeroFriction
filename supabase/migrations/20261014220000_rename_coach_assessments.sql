-- Rename the existing table without deleting its rows or policies.
do $$
begin
  if to_regclass('public.task_assessments') is not null then
    if to_regclass('public.coach_task_assessments') is not null then
      raise exception 'Both assessment tables exist; resolve the conflict before migrating';
    end if;
  elsif to_regclass('public.coach_task_assessments') is not null then
    alter table public.coach_task_assessments rename to task_assessments;
  else
    raise exception 'No assessment table exists to rename';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'task_assessments'
      and column_name = 'trade_type'
  ) then
    raise exception 'task_assessments does not have the Task Clinic schema';
  end if;
end $$;
