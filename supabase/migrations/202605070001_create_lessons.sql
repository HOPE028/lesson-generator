create extension if not exists "pgcrypto";

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  outline text not null check (char_length(outline) between 8 and 2000),
  title text,
  status text not null default 'generating' check (status in ('generating', 'generated', 'failed')),
  typescript_source text,
  lesson_json jsonb,
  trace_id text,
  trace_url text,
  error_message text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
before update on public.lessons
for each row
execute function public.set_updated_at();

alter table public.lessons enable row level security;

drop policy if exists "Lessons are publicly readable" on public.lessons;
create policy "Lessons are publicly readable"
on public.lessons
for select
to anon, authenticated
using (true);

alter publication supabase_realtime add table public.lessons;
