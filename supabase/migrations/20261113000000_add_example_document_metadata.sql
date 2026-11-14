alter table public.task_assessments
  add column if not exists document_attached boolean not null default false,
  add column if not exists document_file_count smallint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_assessments_document_metadata_check'
      and conrelid = 'public.task_assessments'::regclass
  ) then
    alter table public.task_assessments
      add constraint task_assessments_document_metadata_check
      check (
        (document_attached and document_file_count between 1 and 2)
        or (not document_attached and document_file_count = 0)
      );
  end if;
end;
$$;

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'text/plain'
    ]
where id = 'task-assessment-documents';
