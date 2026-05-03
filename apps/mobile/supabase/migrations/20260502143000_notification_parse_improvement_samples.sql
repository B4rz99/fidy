create table if not exists public.notification_parse_improvement_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('notification_android', 'google_pay', 'email_gmail', 'email_outlook')),
  status text not null check (status in ('failed', 'needs_review')),
  confidence_bucket text not null check (confidence_bucket in ('none', 'low', 'medium', 'high')),
  parse_method text not null check (parse_method in ('regex', 'llm')),
  template text not null check (length(trim(template)) > 0 and length(template) <= 1000),
  template_hash text not null check (template_hash ~ '^[0-9a-f]{64}$'),
  review_status text not null default 'pending' check (review_status in ('pending', 'useful', 'ignored', 'implemented')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (reviewed_at is null or review_status <> 'pending')
);

create index if not exists idx_notification_parse_samples_review_status
  on public.notification_parse_improvement_samples (review_status, created_at desc);

alter table public.notification_parse_improvement_samples enable row level security;

drop policy if exists "Users can insert own notification parse improvement samples"
  on public.notification_parse_improvement_samples;
create policy "Users can insert own notification parse improvement samples"
  on public.notification_parse_improvement_samples for insert to authenticated
  with check ((select auth.uid()) = user_id);

alter table public.notification_parse_improvement_samples force row level security;
