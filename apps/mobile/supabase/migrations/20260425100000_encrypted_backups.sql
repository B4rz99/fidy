insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'encrypted-backups',
  'encrypted-backups',
  false,
  52428800,
  array['application/json']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.encrypted_backups (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  schema_version integer not null check (schema_version > 0),
  app_version text not null check (length(trim(app_version)) > 0),
  device_label text not null check (length(trim(device_label)) > 0),
  ciphertext_size_bytes integer not null check (ciphertext_size_bytes > 0),
  ciphertext_sha256 text not null check (ciphertext_sha256 ~ '^[0-9a-f]{64}$'),
  primary key (user_id, id)
);

create index if not exists idx_encrypted_backups_user_created
  on public.encrypted_backups (user_id, created_at desc);

alter table public.encrypted_backups enable row level security;

drop policy if exists "Users can read own encrypted backups" on public.encrypted_backups;
create policy "Users can read own encrypted backups"
  on public.encrypted_backups for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own encrypted backups" on public.encrypted_backups;
create policy "Users can insert own encrypted backups"
  on public.encrypted_backups for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own encrypted backups" on public.encrypted_backups;
create policy "Users can update own encrypted backups"
  on public.encrypted_backups for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own encrypted backups" on public.encrypted_backups;
create policy "Users can delete own encrypted backups"
  on public.encrypted_backups for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own encrypted backup objects" on storage.objects;
create policy "Users can read own encrypted backup objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'encrypted-backups'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can insert own encrypted backup objects" on storage.objects;
create policy "Users can insert own encrypted backup objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'encrypted-backups'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update own encrypted backup objects" on storage.objects;
create policy "Users can update own encrypted backup objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'encrypted-backups'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'encrypted-backups'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own encrypted backup objects" on storage.objects;
create policy "Users can delete own encrypted backup objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'encrypted-backups'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
