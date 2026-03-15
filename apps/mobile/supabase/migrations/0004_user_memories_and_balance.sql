-- User memories table (server-side, replaces local SQLite user_memories)
create table public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fact text not null,
  category text not null check (category in ('habit', 'preference', 'situation', 'goal')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Partial index: only active records
create index idx_user_memories_user_active
  on public.user_memories (user_id)
  where deleted_at is null;

alter table public.user_memories enable row level security;

create policy "Users can read own memories"
  on public.user_memories for select using ((select auth.uid()) = user_id);

create policy "Users can insert own memories"
  on public.user_memories for insert with check ((select auth.uid()) = user_id);

create policy "Users can update own memories"
  on public.user_memories for update using ((select auth.uid()) = user_id);

create policy "Users can delete own memories"
  on public.user_memories for delete using ((select auth.uid()) = user_id);

-- RPC: get_user_balance (security invoker so RLS applies via JWT)
create or replace function get_user_balance()
returns bigint
language sql stable security invoker
as $$
  select coalesce(
    sum(case when type = 'income' then amount_cents else -amount_cents end),
    0
  )::bigint
  from public.transactions
  where user_id = auth.uid() and deleted_at is null;
$$;

-- Optimize existing transactions RLS policies: (select auth.uid()) caches per-query instead of per-row
drop policy "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions for select using ((select auth.uid()) = user_id);

drop policy "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions for insert with check ((select auth.uid()) = user_id);

drop policy "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions for update using ((select auth.uid()) = user_id);

drop policy "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions for delete using ((select auth.uid()) = user_id);
