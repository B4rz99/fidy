create table public.transfers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  from_account_id text,
  to_account_id text,
  from_external_label text,
  to_external_label text,
  description text,
  date text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  constraint ck_transfers_from_endpoint
    check (from_account_id is not null or from_external_label is not null),
  constraint ck_transfers_to_endpoint
    check (to_account_id is not null or to_external_label is not null)
);

create index idx_transfers_user_date
  on public.transfers (user_id, date);

create index idx_transfers_user_updated
  on public.transfers (user_id, updated_at);

alter table public.transfers enable row level security;

create policy "Users can read own transfers"
  on public.transfers for select
  using (auth.uid() = user_id);

create policy "Users can insert own transfers"
  on public.transfers for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transfers"
  on public.transfers for update
  using (auth.uid() = user_id);

create policy "Users can delete own transfers"
  on public.transfers for delete
  using (auth.uid() = user_id);
