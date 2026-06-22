alter table ledger.transactions
  drop constraint if exists ledger_transactions_amount_positive;

alter table ledger.transactions
  add constraint ledger_transactions_amount_positive check (amount > 0);

alter table ledger.transactions
  drop constraint if exists ledger_transactions_date_not_future;

alter table ledger.transactions
  add constraint ledger_transactions_date_not_future check (date <= current_date);

alter table ledger.transactions
  drop constraint if exists ledger_transactions_client_id_shape;

alter table ledger.transactions
  add constraint ledger_transactions_client_id_shape
  check (id ~ '^txn-[A-Za-z0-9][A-Za-z0-9_-]*$');

create unique index if not exists ledger_transactions_global_id_idx
  on ledger.transactions (id);

create table if not exists ledger.transaction_monthly_totals (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  income_amount integer not null default 0 check (income_amount >= 0),
  expense_amount integer not null default 0 check (expense_amount >= 0),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  cursor_sequence bigint not null check (cursor_sequence >= 0),
  rebuilt_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table ledger.transaction_monthly_totals enable row level security;
alter table ledger.transaction_monthly_totals force row level security;

create or replace function ledger.rebuild_transaction_monthly_total(
  p_user_id uuid,
  p_month text,
  p_cursor_sequence bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_start date;
  v_next_month date;
begin
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid ledger projection month';
  end if;

  v_month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_next_month := (v_month_start + interval '1 month')::date;

  insert into ledger.transaction_monthly_totals (
    user_id,
    month,
    income_amount,
    expense_amount,
    transaction_count,
    cursor_sequence,
    rebuilt_at
  )
  select
    p_user_id,
    p_month,
    coalesce(sum(ledger.transactions.amount) filter (
      where ledger.transactions.type = 'income'
    ), 0)::integer,
    coalesce(sum(ledger.transactions.amount) filter (
      where ledger.transactions.type = 'expense'
    ), 0)::integer,
    count(*)::integer,
    p_cursor_sequence,
    now()
  from ledger.transactions
  where ledger.transactions.user_id = p_user_id
    and ledger.transactions.deleted_at is null
    and ledger.transactions.date >= v_month_start
    and ledger.transactions.date < v_next_month
  on conflict (user_id, month) do update set
    income_amount = excluded.income_amount,
    expense_amount = excluded.expense_amount,
    transaction_count = excluded.transaction_count,
    cursor_sequence = excluded.cursor_sequence,
    rebuilt_at = excluded.rebuilt_at;
end;
$$;

create or replace function public.cloud_ledger_create_transaction(
  p_user_id uuid,
  p_command_version integer,
  p_transaction_id text,
  p_type text,
  p_amount integer,
  p_currency text,
  p_category_id text,
  p_account_id text,
  p_description text,
  p_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_sequence bigint;
  v_existing_transaction ledger.transactions%rowtype;
  v_next_sequence bigint;
  v_updated_at timestamptz := now();
  v_month text := to_char(p_date, 'YYYY-MM');
begin
  if p_command_version <> 1 then
    return jsonb_build_object('code', 'unsupported_command_version');
  end if;

  if p_transaction_id is null or p_transaction_id !~ '^txn-[A-Za-z0-9][A-Za-z0-9_-]*$' then
    return jsonb_build_object('code', 'invalid_transaction_id');
  end if;

  if exists (
    select 1
    from ledger.transactions
    where ledger.transactions.id = p_transaction_id
      and ledger.transactions.user_id <> p_user_id
  ) then
    return jsonb_build_object('code', 'unauthorized_transaction_id');
  end if;

  select ledger.transactions.*
  into v_existing_transaction
  from ledger.transactions
  where ledger.transactions.user_id = p_user_id
    and ledger.transactions.id = p_transaction_id;

  if found then
    if v_existing_transaction.deleted_at is null
      and v_existing_transaction.type = p_type
      and v_existing_transaction.amount = p_amount
      and v_existing_transaction.currency = p_currency
      and v_existing_transaction.category_id is not distinct from p_category_id
      and v_existing_transaction.account_id = p_account_id
      and v_existing_transaction.description is not distinct from p_description
      and v_existing_transaction.date = p_date
    then
      select coalesce(
        (
          select ledger.ledger_cursors.latest_sequence
          from ledger.ledger_cursors
          where ledger.ledger_cursors.user_id = p_user_id
        ),
        v_existing_transaction.cursor_sequence
      )
      into v_current_sequence;

      return jsonb_build_object(
        'code', 'accepted',
        'transaction', jsonb_build_object(
          'id', v_existing_transaction.id,
          'type', v_existing_transaction.type,
          'amount', v_existing_transaction.amount,
          'currency', v_existing_transaction.currency,
          'categoryId', v_existing_transaction.category_id,
          'accountId', v_existing_transaction.account_id,
          'description', v_existing_transaction.description,
          'date', v_existing_transaction.date::text,
          'updatedAt', to_char(
            v_existing_transaction.updated_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        ),
        'cursor', 'ledger:' || v_current_sequence::text
      );
    end if;

    return jsonb_build_object('code', 'duplicate_transaction_id');
  end if;

  if not exists (
    select 1
    from ledger.financial_accounts
    where ledger.financial_accounts.user_id = p_user_id
      and ledger.financial_accounts.id = p_account_id
      and ledger.financial_accounts.deleted_at is null
  ) then
    return jsonb_build_object('code', 'invalid_ledger_reference');
  end if;

  if p_category_id is not null and not exists (
    select 1
    from ledger.categories
    where ledger.categories.user_id = p_user_id
      and ledger.categories.id = p_category_id
      and ledger.categories.deleted_at is null
  ) then
    return jsonb_build_object('code', 'invalid_ledger_reference');
  end if;

  insert into ledger.ledger_cursors (user_id, latest_sequence, updated_at)
  values (p_user_id, 0, v_updated_at)
  on conflict (user_id) do nothing;

  select ledger.ledger_cursors.latest_sequence + 1
  into v_next_sequence
  from ledger.ledger_cursors
  where ledger.ledger_cursors.user_id = p_user_id
  for update;

  insert into ledger.transactions (
    user_id,
    id,
    type,
    amount,
    currency,
    category_id,
    account_id,
    description,
    date,
    record_version,
    cursor_sequence,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_transaction_id,
    p_type,
    p_amount,
    p_currency,
    p_category_id,
    p_account_id,
    p_description,
    p_date,
    1,
    v_next_sequence,
    v_updated_at,
    v_updated_at
  );

  update ledger.ledger_cursors
  set latest_sequence = v_next_sequence,
      updated_at = v_updated_at
  where ledger.ledger_cursors.user_id = p_user_id;

  perform ledger.rebuild_transaction_monthly_total(p_user_id, v_month, v_next_sequence);

  return jsonb_build_object(
    'code', 'accepted',
    'transaction', jsonb_build_object(
      'id', p_transaction_id,
      'type', p_type,
      'amount', p_amount,
      'currency', p_currency,
      'categoryId', p_category_id,
      'accountId', p_account_id,
      'description', p_description,
      'date', p_date::text,
      'updatedAt', to_char(
        v_updated_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    ),
    'cursor', 'ledger:' || v_next_sequence::text
  );
exception
  when unique_violation then
    return jsonb_build_object('code', 'duplicate_transaction_id');
  when foreign_key_violation then
    return jsonb_build_object('code', 'invalid_ledger_reference');
  when check_violation then
    return jsonb_build_object('code', 'invalid_transaction');
end;
$$;

revoke execute on function public.cloud_ledger_create_transaction(
  uuid,
  integer,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  date
) from public, anon, authenticated;
grant execute on function public.cloud_ledger_create_transaction(
  uuid,
  integer,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  date
) to service_role;

revoke all on table ledger.transaction_monthly_totals from public, anon, authenticated;
