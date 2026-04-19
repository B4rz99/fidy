create table public.capture_evidence (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_family text not null,
  evidence_type text not null,
  scope text not null,
  value text not null,
  transaction_id text,
  processed_email_id text,
  processed_capture_id text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  constraint ck_capture_evidence_source_record
    check (
      (case when processed_email_id is not null then 1 else 0 end) +
      (case when processed_capture_id is not null then 1 else 0 end) = 1
    )
);

create unique index uq_capture_evidence_email
  on public.capture_evidence (user_id, processed_email_id, scope, value)
  where processed_email_id is not null and deleted_at is null;

create unique index uq_capture_evidence_capture
  on public.capture_evidence (user_id, processed_capture_id, scope, value)
  where processed_capture_id is not null and deleted_at is null;

create index idx_capture_evidence_user_scope_value
  on public.capture_evidence (user_id, scope, value);

create index idx_capture_evidence_transaction
  on public.capture_evidence (transaction_id);

create index idx_capture_evidence_processed_email
  on public.capture_evidence (processed_email_id);

create index idx_capture_evidence_processed_capture
  on public.capture_evidence (processed_capture_id);

create index idx_capture_evidence_user_updated_id
  on public.capture_evidence (user_id, updated_at, id);

alter table public.capture_evidence enable row level security;

create policy "Users can read own capture evidence"
  on public.capture_evidence for select
  using (auth.uid() = user_id);

create policy "Users can insert own capture evidence"
  on public.capture_evidence for insert
  with check (auth.uid() = user_id);

create policy "Users can update own capture evidence"
  on public.capture_evidence for update
  using (auth.uid() = user_id);

create policy "Users can delete own capture evidence"
  on public.capture_evidence for delete
  using (auth.uid() = user_id);
