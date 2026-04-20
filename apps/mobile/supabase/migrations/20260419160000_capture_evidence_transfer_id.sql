alter table public.capture_evidence
  add column transfer_id text;

create index idx_capture_evidence_transfer
  on public.capture_evidence (transfer_id);
