create table public.financial_accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null,
  is_default boolean not null default false,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create index idx_financial_accounts_user
  on public.financial_accounts (user_id);

create index idx_financial_accounts_user_default
  on public.financial_accounts (user_id, is_default);

alter table public.financial_accounts enable row level security;

create policy "Users can read own financial accounts"
  on public.financial_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own financial accounts"
  on public.financial_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own financial accounts"
  on public.financial_accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own financial accounts"
  on public.financial_accounts for delete
  using (auth.uid() = user_id);
