drop policy if exists "Users can read own encrypted backups" on public.encrypted_backups;
drop policy if exists "Users can insert own encrypted backups" on public.encrypted_backups;
drop policy if exists "Users can update own encrypted backups" on public.encrypted_backups;
drop policy if exists "Users can delete own encrypted backups" on public.encrypted_backups;

alter table public.encrypted_backups enable row level security;
alter table public.encrypted_backups force row level security;

drop policy if exists "Users can read own encrypted backup objects" on storage.objects;
drop policy if exists "Users can insert own encrypted backup objects" on storage.objects;
drop policy if exists "Users can update own encrypted backup objects" on storage.objects;
drop policy if exists "Users can delete own encrypted backup objects" on storage.objects;

update storage.buckets
set public = false
where id = 'encrypted-backups';
