create table public.account_suggestion_dismissals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  value text not null,
  dismissed_score integer not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create unique index uq_account_suggestion_dismissals_scope
  on public.account_suggestion_dismissals (user_id, scope, value);

create index idx_account_suggestion_dismissals_user_updated
  on public.account_suggestion_dismissals (user_id, updated_at);

alter table public.account_suggestion_dismissals enable row level security;

create policy "Users can read own account suggestion dismissals"
  on public.account_suggestion_dismissals for select
  using (auth.uid() = user_id);

create policy "Users can insert own account suggestion dismissals"
  on public.account_suggestion_dismissals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own account suggestion dismissals"
  on public.account_suggestion_dismissals for update
  using (auth.uid() = user_id);

create policy "Users can delete own account suggestion dismissals"
  on public.account_suggestion_dismissals for delete
  using (auth.uid() = user_id);
