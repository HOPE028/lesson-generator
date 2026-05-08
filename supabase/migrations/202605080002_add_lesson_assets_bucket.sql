insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lesson-assets',
  'lesson-assets',
  true,
  10485760,
  array['image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Lesson assets are publicly readable" on storage.objects;
create policy "Lesson assets are publicly readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'lesson-assets');
