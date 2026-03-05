create table public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount_cents integer not null check (amount_cents > 0),
  category_id text not null,
  description text,
  date text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

-- Index for sync pulls (filter by user + order by updated_at)
create index idx_transactions_user_updated
  on public.transactions (user_id, updated_at);

-- Row Level Security
alter table public.transactions enable row level security;

create policy "Users can read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);
