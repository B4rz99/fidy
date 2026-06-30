create schema if not exists ledger;

create table if not exists ledger.ledger_cursors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latest_sequence bigint not null default 0 check (latest_sequence >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists ledger.categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(trim(id)) > 0),
  name text not null check (length(trim(name)) > 0),
  icon text,
  color text,
  cursor_sequence bigint not null default 0 check (cursor_sequence >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists ledger.financial_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(trim(id)) > 0),
  name text not null check (length(trim(name)) > 0),
  type text not null check (length(trim(type)) > 0),
  currency text not null default 'COP' check (currency = 'COP'),
  cursor_sequence bigint not null default 0 check (cursor_sequence >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists ledger.transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(trim(id)) > 0),
  type text not null check (type in ('income', 'expense')),
  amount integer not null check (amount >= 0),
  currency text not null default 'COP' check (currency = 'COP'),
  category_id text check (category_id is null or length(trim(category_id)) > 0),
  account_id text not null check (length(trim(account_id)) > 0),
  description text,
  date date not null,
  record_version integer not null default 1 check (record_version > 0),
  cursor_sequence bigint not null default 0 check (cursor_sequence >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, category_id) references ledger.categories(user_id, id),
  foreign key (user_id, account_id) references ledger.financial_accounts(user_id, id)
);

create table if not exists ledger.tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('category', 'financial_account', 'transaction')),
  record_id text not null check (length(trim(record_id)) > 0),
  cursor_sequence bigint not null check (cursor_sequence >= 0),
  deleted_at timestamptz not null default now(),
  primary key (user_id, record_type, record_id)
);

create index if not exists ledger_categories_refresh_idx
  on ledger.categories (user_id, cursor_sequence)
  where deleted_at is null;

create index if not exists ledger_financial_accounts_refresh_idx
  on ledger.financial_accounts (user_id, cursor_sequence)
  where deleted_at is null;

create index if not exists ledger_transactions_refresh_idx
  on ledger.transactions (user_id, cursor_sequence)
  where deleted_at is null;

create index if not exists ledger_tombstones_refresh_idx
  on ledger.tombstones (user_id, cursor_sequence);

alter table ledger.ledger_cursors enable row level security;
alter table ledger.categories enable row level security;
alter table ledger.financial_accounts enable row level security;
alter table ledger.transactions enable row level security;
alter table ledger.tombstones enable row level security;

alter table ledger.ledger_cursors force row level security;
alter table ledger.categories force row level security;
alter table ledger.financial_accounts force row level security;
alter table ledger.transactions force row level security;
alter table ledger.tombstones force row level security;

create or replace function public.cloud_ledger_bootstrap(
  p_user_id uuid,
  p_after_sequence bigint default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
with cursor_state as (
  select coalesce(
    (
      select ledger.ledger_cursors.latest_sequence
      from ledger.ledger_cursors
      where ledger.ledger_cursors.user_id = p_user_id
    ),
    0
  ) as latest_sequence
),
category_rows as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ledger.categories.id,
        'name', ledger.categories.name,
        'icon', ledger.categories.icon,
        'color', ledger.categories.color,
        'updatedAt', to_char(
          ledger.categories.updated_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
      order by ledger.categories.cursor_sequence, ledger.categories.id
    ),
    '[]'::jsonb
  ) as rows
  from ledger.categories
  where ledger.categories.user_id = p_user_id
    and ledger.categories.deleted_at is null
    and (
      p_after_sequence is null
      or ledger.categories.cursor_sequence > p_after_sequence
    )
),
financial_account_rows as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ledger.financial_accounts.id,
        'name', ledger.financial_accounts.name,
        'type', ledger.financial_accounts.type,
        'currency', ledger.financial_accounts.currency,
        'updatedAt', to_char(
          ledger.financial_accounts.updated_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
      order by ledger.financial_accounts.cursor_sequence, ledger.financial_accounts.id
    ),
    '[]'::jsonb
  ) as rows
  from ledger.financial_accounts
  where ledger.financial_accounts.user_id = p_user_id
    and ledger.financial_accounts.deleted_at is null
    and (
      p_after_sequence is null
      or ledger.financial_accounts.cursor_sequence > p_after_sequence
    )
),
transaction_rows as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ledger.transactions.id,
        'type', ledger.transactions.type,
        'amount', ledger.transactions.amount,
        'currency', ledger.transactions.currency,
        'categoryId', ledger.transactions.category_id,
        'accountId', ledger.transactions.account_id,
        'description', ledger.transactions.description,
        'date', ledger.transactions.date::text,
        'version', ledger.transactions.record_version,
        'updatedAt', to_char(
          ledger.transactions.updated_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
      order by ledger.transactions.cursor_sequence, ledger.transactions.id
    ),
    '[]'::jsonb
  ) as rows
  from ledger.transactions
  where ledger.transactions.user_id = p_user_id
    and ledger.transactions.deleted_at is null
    and (
      p_after_sequence is null
      or ledger.transactions.cursor_sequence > p_after_sequence
    )
),
tombstone_rows as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'recordType', case ledger.tombstones.record_type
          when 'financial_account' then 'financialAccount'
          else ledger.tombstones.record_type
        end,
        'recordId', ledger.tombstones.record_id,
        'deletedAt', to_char(
          ledger.tombstones.deleted_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
      order by ledger.tombstones.cursor_sequence, ledger.tombstones.record_type, ledger.tombstones.record_id
    ),
    '[]'::jsonb
  ) as rows
  from ledger.tombstones
  where ledger.tombstones.user_id = p_user_id
    and (
      p_after_sequence is null
      or ledger.tombstones.cursor_sequence > p_after_sequence
    )
)
select jsonb_build_object(
  'cursor', 'ledger:' || cursor_state.latest_sequence::text,
  'categories', category_rows.rows,
  'financialAccounts', financial_account_rows.rows,
  'transactions', transaction_rows.rows,
  'tombstones', tombstone_rows.rows
)
from cursor_state, category_rows, financial_account_rows, transaction_rows, tombstone_rows;
$$;

revoke execute on function public.cloud_ledger_bootstrap(uuid, bigint) from public, anon, authenticated;
grant execute on function public.cloud_ledger_bootstrap(uuid, bigint) to service_role;

revoke all on schema ledger from public;
revoke usage on schema ledger from anon, authenticated;
revoke all on all tables in schema ledger from public;
revoke all on all tables in schema ledger from anon, authenticated;
alter default privileges in schema ledger revoke all on tables from public;
alter default privileges in schema ledger revoke all on tables from anon, authenticated;
