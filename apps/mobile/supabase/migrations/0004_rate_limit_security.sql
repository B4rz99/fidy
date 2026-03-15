-- Fix SECURITY DEFINER function: pin search_path and revoke public access

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
