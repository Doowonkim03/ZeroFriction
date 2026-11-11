insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'task-assessment-documents',
  'task-assessment-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Block client access to assessment documents" on storage.objects;
create policy "Block client access to assessment documents"
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'task-assessment-documents')
  with check (bucket_id <> 'task-assessment-documents');
