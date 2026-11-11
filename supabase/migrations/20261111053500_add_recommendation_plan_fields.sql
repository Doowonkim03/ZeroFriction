alter table public.task_assessments
  add column if not exists recommendation_plan jsonb,
  add column if not exists recommendation_source text;
