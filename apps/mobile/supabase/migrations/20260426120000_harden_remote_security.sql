-- Harden the active remote surface after plaintext financial tables were retired.

alter table public.bank_senders enable row level security;
drop policy if exists "Authenticated users can read bank senders" on public.bank_senders;
create policy "Authenticated users can read bank senders"
  on public.bank_senders for select to authenticated
  using (true);
alter table public.bank_senders force row level security;

alter table public.user_memories enable row level security;
drop policy if exists "Users can read own memories" on public.user_memories;
create policy "Users can read own memories"
  on public.user_memories for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own memories" on public.user_memories;
create policy "Users can insert own memories"
  on public.user_memories for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own memories" on public.user_memories;
create policy "Users can update own memories"
  on public.user_memories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own memories" on public.user_memories;
create policy "Users can delete own memories"
  on public.user_memories for delete to authenticated
  using ((select auth.uid()) = user_id);
alter table public.user_memories force row level security;

alter table public.push_devices enable row level security;
drop policy if exists "Users can manage own push devices" on public.push_devices;
drop policy if exists "Users can read own push devices" on public.push_devices;
create policy "Users can read own push devices"
  on public.push_devices for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own push devices" on public.push_devices;
create policy "Users can insert own push devices"
  on public.push_devices for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own push devices" on public.push_devices;
create policy "Users can update own push devices"
  on public.push_devices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own push devices" on public.push_devices;
create policy "Users can delete own push devices"
  on public.push_devices for delete to authenticated
  using ((select auth.uid()) = user_id);
alter table public.push_devices force row level security;

alter table public.notification_preferences enable row level security;
drop policy if exists "Users can manage own notification preferences" on public.notification_preferences;
drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences"
  on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own notification preferences" on public.notification_preferences;
create policy "Users can delete own notification preferences"
  on public.notification_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);
alter table public.notification_preferences force row level security;

alter table public.encrypted_backups force row level security;
alter table public.waitlist_emails force row level security;
alter table public.rate_limits force row level security;

create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_function_name text,
  p_window_key text,
  p_max_count integer
)
returns table (current_count integer, allowed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if random() < 0.01 then
    delete from public.rate_limits
    where window_key < to_char(now() - interval '2 hours', 'YYYY-MM-DD"T"HH24:MI');
  end if;

  return query
    insert into public.rate_limits (user_id, function_name, window_key, request_count)
    values (p_user_id, p_function_name, p_window_key, 1)
    on conflict on constraint rate_limits_pkey
    do update set request_count = public.rate_limits.request_count + 1
    returning
      public.rate_limits.request_count as current_count,
      (public.rate_limits.request_count <= p_max_count) as allowed;
end;
$$;

revoke execute on function public.check_rate_limit(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, text, text, integer) to service_role;
