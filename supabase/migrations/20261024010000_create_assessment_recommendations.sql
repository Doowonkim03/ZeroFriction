create table if not exists public.task_assessment_recommendations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.task_assessments(id) on delete cascade,
  relevance_ranking smallint not null check (relevance_ranking between 1 and 2),
  ai_use_case text not null,
  recommendation_reason text not null,
  potential_benefit text not null,
  ranking_details jsonb not null,
  created_at timestamptz not null default now(),
  unique (assessment_id, relevance_ranking)
);

alter table public.task_assessment_recommendations enable row level security;

create or replace function public.save_task_assessment_recommendations(
  p_assessment_id uuid,
  p_recommendations jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recommendation jsonb;
  recommendation_count integer;
  first_recommendation jsonb;
begin
  if jsonb_typeof(p_recommendations) is distinct from 'array' then
    raise exception 'Recommendations must be an array';
  end if;

  recommendation_count := jsonb_array_length(p_recommendations);
  if recommendation_count < 1 or recommendation_count > 2 then
    raise exception 'Provide between one and two recommendations';
  end if;

  for recommendation in
    select value
    from jsonb_array_elements(p_recommendations) with ordinality as item(value, ordinal)
  loop
    if jsonb_typeof(recommendation -> 'relevance_ranking') is distinct from 'number'
      or recommendation ->> 'relevance_ranking' not in ('1', '2')
      or jsonb_typeof(recommendation -> 'ai_use_case') is distinct from 'string'
      or length(trim(recommendation ->> 'ai_use_case')) = 0
      or jsonb_typeof(recommendation -> 'recommendation_reason') is distinct from 'string'
      or length(trim(recommendation ->> 'recommendation_reason')) = 0
      or jsonb_typeof(recommendation -> 'potential_benefit') is distinct from 'string'
      or length(trim(recommendation ->> 'potential_benefit')) = 0
      or jsonb_typeof(recommendation -> 'ranking_details') is distinct from 'object' then
      raise exception 'Recommendation fields are invalid';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_recommendations) with ordinality as item(value, ordinal)
    where value ->> 'relevance_ranking' is distinct from ordinal::text
  ) then
    raise exception 'Recommendation ranks must be sequential and start at one';
  end if;

  if not exists (
    select 1 from public.task_assessments where id = p_assessment_id
  ) then
    raise exception 'Assessment not found';
  end if;

  first_recommendation := p_recommendations -> 0;
  delete from public.task_assessment_recommendations
  where assessment_id = p_assessment_id;

  insert into public.task_assessment_recommendations (
    assessment_id,
    relevance_ranking,
    ai_use_case,
    recommendation_reason,
    potential_benefit,
    ranking_details
  )
  select
    p_assessment_id,
    (value ->> 'relevance_ranking')::smallint,
    value ->> 'ai_use_case',
    value ->> 'recommendation_reason',
    value ->> 'potential_benefit',
    value -> 'ranking_details'
  from jsonb_array_elements(p_recommendations) as item(value);

  update public.task_assessments
  set ai_use_case = first_recommendation ->> 'ai_use_case',
      recommendation_reason = first_recommendation ->> 'recommendation_reason',
      potential_benefit = first_recommendation ->> 'potential_benefit',
      relevance_ranking = (first_recommendation ->> 'relevance_ranking')::bigint
  where id = p_assessment_id;
end;
$$;

revoke all on function public.save_task_assessment_recommendations(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_task_assessment_recommendations(uuid, jsonb)
  to service_role;
