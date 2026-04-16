create table public.accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  system_key text,
  account_class text not null check (account_class in ('asset', 'liability')),
  account_subtype text not null check (
    account_subtype in (
      'checking',
      'savings',
      'cash',
      'digital_holding',
      'credit_card',
      'loan',
      'investment',
      'other'
    )
  ),
  name text not null,
  institution text not null,
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  baseline_amount integer not null,
  baseline_date text not null,
  credit_limit integer check (credit_limit is null or credit_limit >= 0),
  closing_day integer check (closing_day is null or closing_day between 1 and 31),
  due_day integer check (due_day is null or due_day between 1 and 31),
  archived_at text,
  created_at text not null,
  updated_at text not null,
  unique (user_id, system_key)
);

create index idx_accounts_user_active
  on public.accounts (user_id, archived_at);

create index idx_accounts_user_subtype
  on public.accounts (user_id, account_subtype);

alter table public.accounts enable row level security;

create policy "Users can read own accounts"
  on public.accounts for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own accounts"
  on public.accounts for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own accounts"
  on public.accounts for update
  using ((select auth.uid()) = user_id);

create policy "Users can delete own accounts"
  on public.accounts for delete
  using ((select auth.uid()) = user_id);
