-- DRAFT migration: tables for the six-question coach + AI recommendation flow.
-- Do NOT apply until the group has agreed the design.
-- WARNING: this drops the existing tables and their sample rows.
-- Verify the allowed values for trade, tools and readiness against ZF_DATA in
-- Week5_AI_Coach.html before adding any check constraints on those columns.

drop table if exists public.task_recommendations;
drop table if exists public.task_assessments;
drop table if exists public.coach_task_assessments;

-- One row per coaching session
create table public.task_assessments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trade_type text not null,
  business_size integer not null check (business_size between 1 and 200),
  task_type text not null,
  admin_pain_points text,        -- the bottleneck the user selects
  current_tools text,
  ai_readiness text,
  document_text text check (char_length(document_text) <= 20000),  -- extracted text of the example document
  identified_pain_points text    -- filled in by the AI analysis
);

-- Up to two rows per session (one-to-many with task_assessments)
create table public.task_recommendations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.task_assessments(id) on delete cascade,
  created_at timestamptz not null default now(),
  relevance_ranking smallint not null check (relevance_ranking in (1, 2)),
  ai_use_case text not null,
  recommendation_reason text not null,
  potential_benefit text not null,   -- qualitative hypothesis, no exact time savings
  suggested_approach text,
  first_action text not null,
  is_selected boolean not null default false,
  unique (assessment_id, relevance_ranking)
);

-- At most one selected recommendation per session
create unique index one_selected_per_assessment
  on public.task_recommendations (assessment_id)
  where is_selected;

-- Lock both tables to the public. With no policies, the anon key can neither
-- read nor write; only the Edge Function (service role) can.
alter table public.task_assessments enable row level security;
alter table public.task_recommendations enable row level security;
