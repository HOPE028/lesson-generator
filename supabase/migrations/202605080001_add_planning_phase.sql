alter table public.lessons
  add column if not exists planning_typescript_source text,
  add column if not exists planning_json jsonb;

alter table public.lessons
  drop constraint if exists lessons_status_check;

alter table public.lessons
  add constraint lessons_status_check
  check (status in ('planning', 'generating', 'validating', 'generated', 'failed'));

alter table public.lessons
  alter column status set default 'planning';
