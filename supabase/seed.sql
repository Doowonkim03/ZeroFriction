-- Fictional assessment records from the INFS3605 sample table.
-- Stable IDs make this seed safe to rerun without creating duplicates.
-- File references are sample names; this script does not upload files.
insert into public.task_assessments (
  id,
  trade_type,
  business_size,
  admin_pain_points,
  task_type,
  uploaded_file_ref,
  identified_pain_points,
  ai_use_case,
  recommendation_reason,
  potential_benefit,
  relevance_ranking,
  selected_use_case,
  first_action
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'Electrical',
    6,
    'Quoting takes too long',
    'Quoting',
    'sample_quote_01.pdf',
    'Repetitive quote descriptions',
    'AI-assisted quote drafting',
    'Similar quote content is repeatedly written manually',
    'Reduce quote preparation time',
    1,
    'AI-assisted quote drafting',
    'Test AI on one sample quote'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Plumbing',
    4,
    'Customer enquiries and invoices',
    'Customer communication',
    'sample_email_01.pdf',
    'Repetitive enquiry responses',
    'AI-assisted customer responses',
    'Common enquiries require similar responses',
    'Reduce time responding to routine enquiries',
    1,
    'AI-assisted customer responses',
    'Test AI using five common customer enquiries'
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Carpentry',
    8,
    'Repetitive quote preparation',
    'Quoting',
    'sample_quote_02.pdf',
    'Repeated manual quote writing',
    'AI-assisted quote generation',
    'Similar job information is repeatedly converted into quotes',
    'Faster first drafts of quotes',
    1,
    'AI-assisted quote generation',
    'Compare an AI-generated draft against an existing quote'
  )
on conflict (id) do nothing;
