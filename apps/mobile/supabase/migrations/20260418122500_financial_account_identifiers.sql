create table public.financial_account_identifiers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  scope text not null,
  value text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create unique index uq_financial_account_identifier
  on public.financial_account_identifiers (user_id, account_id, scope, value);

create index idx_financial_account_identifiers_account
  on public.financial_account_identifiers (account_id);

alter table public.financial_account_identifiers enable row level security;

create policy "Users can read own financial account identifiers"
  on public.financial_account_identifiers for select
  using (auth.uid() = user_id);

create policy "Users can insert own financial account identifiers"
  on public.financial_account_identifiers for insert
  with check (auth.uid() = user_id);

create policy "Users can update own financial account identifiers"
  on public.financial_account_identifiers for update
  using (auth.uid() = user_id);

create policy "Users can delete own financial account identifiers"
  on public.financial_account_identifiers for delete
  using (auth.uid() = user_id);
