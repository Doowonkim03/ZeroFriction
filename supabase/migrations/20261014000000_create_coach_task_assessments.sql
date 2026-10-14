-- Coach assessment records. Kept separate from the existing task_assessments table.
-- Recommendation fields can be filled after the initial business details.
create table public.coach_task_assessments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trade_type text,
  business_size bigint check (business_size >= 0),
  admin_pain_points text,
  task_type text,
  uploaded_file_ref text,
  identified_pain_points text,
  ai_use_case text,
  recommendation_reason text,
  potential_benefit text,
  relevance_ranking bigint check (relevance_ranking >= 1),
  selected_use_case text,
  first_action text
);

-- No client access policy is defined yet. Add scoped policies when the
-- application's authentication and ownership model is decided.
alter table public.coach_task_assessments enable row level security;
