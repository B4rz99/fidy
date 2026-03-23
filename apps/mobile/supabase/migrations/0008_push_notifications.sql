-- Push notification device tokens
create table public.push_devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  app_version text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, expo_push_token)
);

alter table public.push_devices enable row level security;

create policy "Users can manage own push devices"
  on public.push_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Per-user notification preferences (one row per user)
create table public.notification_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  budget_alerts boolean default true not null,
  goal_milestones boolean default true not null,
  spending_anomalies boolean default true not null,
  weekly_digest boolean default true not null,
  updated_at timestamptz default now() not null
);

alter table public.notification_preferences enable row level security;

create policy "Users can manage own notification preferences"
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Weekly digest cron (Sunday midnight UTC = Sunday 7pm COT)
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase)
-- Prerequisites: store secrets in vault before running this migration:
--   INSERT INTO vault.secrets (name, secret) VALUES ('project_url', 'https://<ref>.supabase.co');
--   INSERT INTO vault.secrets (name, secret) VALUES ('service_role_key', '<key>');
select cron.schedule(
  'weekly-digest',
  '0 0 * * 0',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
