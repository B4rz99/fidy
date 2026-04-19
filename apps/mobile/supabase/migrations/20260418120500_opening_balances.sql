create table public.opening_balances (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  amount integer not null,
  effective_date text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create unique index uq_opening_balances_account
  on public.opening_balances (account_id);

create index idx_opening_balances_user
  on public.opening_balances (user_id);

alter table public.opening_balances enable row level security;

create policy "Users can read own opening balances"
  on public.opening_balances for select
  using (auth.uid() = user_id);

create policy "Users can insert own opening balances"
  on public.opening_balances for insert
  with check (auth.uid() = user_id);

create policy "Users can update own opening balances"
  on public.opening_balances for update
  using (auth.uid() = user_id);

create policy "Users can delete own opening balances"
  on public.opening_balances for delete
  using (auth.uid() = user_id);
