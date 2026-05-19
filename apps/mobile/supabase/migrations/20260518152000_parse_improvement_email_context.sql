alter table public.notification_parse_improvement_samples
  add column if not exists sender_domain text;

alter table public.notification_parse_improvement_samples
  drop constraint if exists notification_parse_improvement_samples_sender_domain_check;

alter table public.notification_parse_improvement_samples
  add constraint notification_parse_improvement_samples_sender_domain_check
  check (
    sender_domain is null
    or sender_domain ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$'
  );

create index if not exists idx_notification_parse_samples_sender_domain
  on public.notification_parse_improvement_samples (sender_domain, review_status, created_at desc)
  where sender_domain is not null;
