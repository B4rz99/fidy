alter table public.notification_parse_improvement_samples
  drop constraint if exists notification_parse_improvement_samples_source_check;

alter table public.notification_parse_improvement_samples
  add constraint notification_parse_improvement_samples_source_check
  check (source in ('notification_android', 'google_pay', 'email_gmail', 'email_outlook'));
