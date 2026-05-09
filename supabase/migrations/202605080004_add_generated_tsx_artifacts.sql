alter table public.lessons
  add column if not exists tsx_source text,
  add column if not exists render_tree_json jsonb,
  add column if not exists asset_manifest_json jsonb;
