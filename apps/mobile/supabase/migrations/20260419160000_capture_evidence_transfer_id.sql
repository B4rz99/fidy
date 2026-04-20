alter table public.capture_evidence
  add column transfer_id text;

alter table public.capture_evidence
  add constraint ck_capture_evidence_financial_link
  check (transaction_id is null or transfer_id is null);

create index idx_capture_evidence_transfer
  on public.capture_evidence (transfer_id);
