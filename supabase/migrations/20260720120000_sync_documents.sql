-- MIRIN cloud sync: one document store per user, mirrored from Dexie.
-- Apply in Supabase → SQL Editor (or via supabase db push).

create table if not exists public.sync_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, collection, id)
);

create index if not exists sync_documents_pull_idx
  on public.sync_documents (user_id, updated_at);

alter table public.sync_documents enable row level security;

drop policy if exists "sync_documents_select_own" on public.sync_documents;
create policy "sync_documents_select_own"
  on public.sync_documents
  for select
  using (auth.uid() = user_id);

drop policy if exists "sync_documents_insert_own" on public.sync_documents;
create policy "sync_documents_insert_own"
  on public.sync_documents
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "sync_documents_update_own" on public.sync_documents;
create policy "sync_documents_update_own"
  on public.sync_documents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sync_documents_delete_own" on public.sync_documents;
create policy "sync_documents_delete_own"
  on public.sync_documents
  for delete
  using (auth.uid() = user_id);
