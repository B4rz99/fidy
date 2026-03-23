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
