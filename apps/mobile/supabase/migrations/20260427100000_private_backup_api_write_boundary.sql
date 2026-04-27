drop policy if exists "Users can read own encrypted backups" on public.encrypted_backups;
drop policy if exists "Users can insert own encrypted backups" on public.encrypted_backups;
drop policy if exists "Users can update own encrypted backups" on public.encrypted_backups;
drop policy if exists "Users can delete own encrypted backups" on public.encrypted_backups;

drop policy if exists "Users can read own encrypted backup objects" on storage.objects;
drop policy if exists "Users can insert own encrypted backup objects" on storage.objects;
drop policy if exists "Users can update own encrypted backup objects" on storage.objects;
drop policy if exists "Users can delete own encrypted backup objects" on storage.objects;
