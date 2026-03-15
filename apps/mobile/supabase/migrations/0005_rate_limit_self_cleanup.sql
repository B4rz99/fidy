-- Replace SQL function with plpgsql to add probabilistic self-cleanup.
-- On ~1% of calls, deletes stale rows older than 2 hours before the upsert.

create or replace function public.check_rate_limit(
  p_user_id       uuid,
  p_function_name text,
  p_window_key    text,
  p_max_count     integer
)
returns table (current_count integer, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Probabilistic cleanup: ~1% of calls purge stale windows
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

-- Re-apply privilege restriction (CREATE OR REPLACE resets grants)
revoke execute on function public.check_rate_limit from public, anon, authenticated;
