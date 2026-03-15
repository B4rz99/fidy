-- Rate limit counter table
create table public.rate_limits (
  user_id        uuid    not null,
  function_name  text    not null,
  window_key     text    not null,
  request_count  integer not null default 1,
  constraint rate_limits_pkey primary key (user_id, function_name, window_key),
  constraint rate_limits_count_positive check (request_count > 0)
);

-- RLS enabled, no policies = inaccessible to anon/authenticated
-- Service role (used by Edge Functions) bypasses RLS
alter table public.rate_limits enable row level security;

-- Index for cleanup queries
create index idx_rate_limits_window_key on public.rate_limits (window_key);

-- Atomic check-and-increment function
create or replace function public.check_rate_limit(
  p_user_id       uuid,
  p_function_name text,
  p_window_key    text,
  p_max_count     integer
)
returns table (current_count integer, allowed boolean)
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limits (user_id, function_name, window_key, request_count)
  values (p_user_id, p_function_name, p_window_key, 1)
  on conflict on constraint rate_limits_pkey
  do update set request_count = public.rate_limits.request_count + 1
  returning
    public.rate_limits.request_count as current_count,
    (public.rate_limits.request_count <= p_max_count) as allowed;
$$;

-- Only service role (Edge Functions) may call this function
revoke execute on function public.check_rate_limit from public, anon, authenticated;

-- TODO: enable cleanup before launch — rows grow ~1M/day with active users
-- Hourly cleanup (uncomment if pg_cron is enabled)
-- select cron.schedule('cleanup-rate-limits', '0 * * * *',
--   $$delete from public.rate_limits
--     where window_key < to_char(now() - interval '1 hour', 'YYYY-MM-DD"T"HH24:MI')$$
-- );
