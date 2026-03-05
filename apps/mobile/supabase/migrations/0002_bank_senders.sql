create table public.bank_senders (
  id uuid primary key default gen_random_uuid(),
  bank text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- All authenticated users can read bank senders
alter table public.bank_senders enable row level security;

create policy "Authenticated users can read bank senders"
  on public.bank_senders for select
  using (auth.role() = 'authenticated');

-- Seed with default senders
insert into public.bank_senders (bank, email) values
  ('Davibank', 'davibankinforma@davibank.com'),
  ('BBVA', 'BBVA@bbvanet.com.co'),
  ('Rappi', 'noreply@rappicard.co');
