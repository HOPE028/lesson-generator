alter table public.lessons
  drop constraint if exists lessons_status_check;

alter table public.lessons
  add constraint lessons_status_check
  check (status in ('planning', 'generating', 'validating', 'illustrating', 'generated', 'failed'));
