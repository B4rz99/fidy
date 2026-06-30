create table if not exists ledger.transaction_edit_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  change_id text not null check (length(trim(change_id)) > 0),
  action text not null check (action in ('amend', 'delete')),
  transaction_id text not null check (length(trim(transaction_id)) > 0),
  previous_record_version integer not null check (previous_record_version > 0),
  new_record_version integer not null check (new_record_version > previous_record_version),
  previous_payload jsonb not null,
  new_payload jsonb,
  cursor_sequence bigint not null check (cursor_sequence >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, change_id),
  foreign key (user_id, transaction_id) references ledger.transactions(user_id, id)
);

create index if not exists ledger_transaction_edit_history_record_idx
  on ledger.transaction_edit_history (user_id, transaction_id, cursor_sequence);

alter table ledger.transaction_edit_history enable row level security;
alter table ledger.transaction_edit_history force row level security;

create or replace function ledger.transaction_payload(p_transaction ledger.transactions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_transaction.id,
    'type', p_transaction.type,
    'amount', p_transaction.amount,
    'currency', p_transaction.currency,
    'categoryId', p_transaction.category_id,
    'accountId', p_transaction.account_id,
    'description', p_transaction.description,
    'date', p_transaction.date::text
  );
$$;

revoke execute on function ledger.transaction_payload(ledger.transactions)
  from public, anon, authenticated;

create or replace function ledger.accepted_transaction_payload(p_transaction ledger.transactions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_transaction.id,
    'type', p_transaction.type,
    'amount', p_transaction.amount,
    'currency', p_transaction.currency,
    'categoryId', p_transaction.category_id,
    'accountId', p_transaction.account_id,
    'description', p_transaction.description,
    'date', p_transaction.date::text,
    'version', p_transaction.record_version,
    'updatedAt', to_char(
      p_transaction.updated_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );
$$;

revoke execute on function ledger.accepted_transaction_payload(ledger.transactions)
  from public, anon, authenticated;

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

revoke execute on function public.cloud_ledger_bootstrap(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.cloud_ledger_bootstrap(uuid, bigint)
  to service_role;

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
  v_new_transaction ledger.transactions%rowtype;
  v_next_sequence bigint;
  v_updated_at timestamptz := now();
  v_month text := to_char(p_date, 'YYYY-MM');
  v_should_seed_account boolean := false;
  v_should_seed_category boolean := false;
begin
  if p_command_version is distinct from 1 then
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
        'transaction', ledger.accepted_transaction_payload(v_existing_transaction),
        'cursor', 'ledger:' || v_current_sequence::text
      );
    end if;

    return jsonb_build_object('code', 'duplicate_transaction_id');
  end if;

  if p_type is null
    or p_type not in ('expense', 'income')
    or p_amount is null
    or p_amount <= 0
    or p_currency is distinct from 'COP'
    or p_date is null
    or p_date > current_date
    or length(coalesce(p_description, '')) > 200
  then
    return jsonb_build_object('code', 'invalid_transaction');
  end if;

  insert into ledger.ledger_cursors (user_id, latest_sequence, updated_at)
  values (p_user_id, 0, v_updated_at)
  on conflict (user_id) do nothing;

  if p_account_id is null or length(trim(p_account_id)) = 0 then
    return jsonb_build_object('code', 'invalid_ledger_reference');
  end if;

  if not exists (
    select 1
    from ledger.financial_accounts
    where ledger.financial_accounts.user_id = p_user_id
      and ledger.financial_accounts.id = p_account_id
      and ledger.financial_accounts.deleted_at is null
  ) then
    if exists (
      select 1
      from ledger.financial_accounts
      where ledger.financial_accounts.user_id = p_user_id
        and ledger.financial_accounts.id = p_account_id
    ) then
      return jsonb_build_object('code', 'invalid_ledger_reference');
    end if;
    v_should_seed_account := true;
  end if;

  if p_category_id is not null and length(trim(p_category_id)) = 0 then
    return jsonb_build_object('code', 'invalid_ledger_reference');
  end if;

  if p_category_id is not null and not exists (
    select 1
    from ledger.categories
    where ledger.categories.user_id = p_user_id
      and ledger.categories.id = p_category_id
      and ledger.categories.deleted_at is null
  ) then
    if exists (
      select 1
      from ledger.categories
      where ledger.categories.user_id = p_user_id
        and ledger.categories.id = p_category_id
    ) then
      return jsonb_build_object('code', 'invalid_ledger_reference');
    end if;
    v_should_seed_category := true;
  end if;

  if v_should_seed_account then
    select ledger.ledger_cursors.latest_sequence + 1
    into v_next_sequence
    from ledger.ledger_cursors
    where ledger.ledger_cursors.user_id = p_user_id
    for update;

    if not exists (
      select 1
      from ledger.financial_accounts
      where ledger.financial_accounts.user_id = p_user_id
        and ledger.financial_accounts.id = p_account_id
        and ledger.financial_accounts.deleted_at is null
    ) then
      if exists (
        select 1
        from ledger.financial_accounts
        where ledger.financial_accounts.user_id = p_user_id
          and ledger.financial_accounts.id = p_account_id
      ) then
        return jsonb_build_object('code', 'invalid_ledger_reference');
      end if;

      insert into ledger.financial_accounts (
        user_id,
        id,
        name,
        type,
        currency,
        cursor_sequence,
        created_at,
        updated_at
      ) values (
        p_user_id,
        p_account_id,
        p_account_id,
        'cash',
        'COP',
        v_next_sequence,
        v_updated_at,
        v_updated_at
      );

      update ledger.ledger_cursors
      set latest_sequence = v_next_sequence,
          updated_at = v_updated_at
      where ledger.ledger_cursors.user_id = p_user_id;
    end if;
  end if;

  if v_should_seed_category then
    select ledger.ledger_cursors.latest_sequence + 1
    into v_next_sequence
    from ledger.ledger_cursors
    where ledger.ledger_cursors.user_id = p_user_id
    for update;

    if not exists (
      select 1
      from ledger.categories
      where ledger.categories.user_id = p_user_id
        and ledger.categories.id = p_category_id
        and ledger.categories.deleted_at is null
    ) then
      if exists (
        select 1
        from ledger.categories
        where ledger.categories.user_id = p_user_id
          and ledger.categories.id = p_category_id
      ) then
        return jsonb_build_object('code', 'invalid_ledger_reference');
      end if;

      insert into ledger.categories (
        user_id,
        id,
        name,
        icon,
        color,
        cursor_sequence,
        created_at,
        updated_at
      ) values (
        p_user_id,
        p_category_id,
        p_category_id,
        null,
        null,
        v_next_sequence,
        v_updated_at,
        v_updated_at
      );

      update ledger.ledger_cursors
      set latest_sequence = v_next_sequence,
          updated_at = v_updated_at
      where ledger.ledger_cursors.user_id = p_user_id;
    end if;
  end if;

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
  )
  returning ledger.transactions.*
  into v_new_transaction;

  update ledger.ledger_cursors
  set latest_sequence = v_next_sequence,
      updated_at = v_updated_at
  where ledger.ledger_cursors.user_id = p_user_id;

  perform ledger.rebuild_transaction_monthly_total(p_user_id, v_month, v_next_sequence);

  return jsonb_build_object(
    'code', 'accepted',
    'transaction', ledger.accepted_transaction_payload(v_new_transaction),
    'cursor', 'ledger:' || v_next_sequence::text
  );
exception
  when unique_violation then
    return jsonb_build_object('code', 'duplicate_transaction_id');
  when foreign_key_violation then
    return jsonb_build_object('code', 'invalid_ledger_reference');
  when check_violation or not_null_violation then
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

create or replace function ledger.apply_transaction_amend(
  p_user_id uuid,
  p_command_version integer,
  p_change_id text,
  p_expected_record_version integer,
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
  v_existing_transaction ledger.transactions%rowtype;
  v_next_sequence bigint;
  v_new_transaction ledger.transactions%rowtype;
  v_old_month text;
  v_new_month text;
  v_updated_at timestamptz := now();
begin
  if p_command_version is distinct from 1 then
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

  if p_type is null
    or p_type not in ('expense', 'income')
    or p_amount is null
    or p_amount <= 0
    or p_currency is distinct from 'COP'
    or p_date is null
    or p_date > current_date
    or length(coalesce(p_description, '')) > 200
  then
    return jsonb_build_object('code', 'invalid_transaction');
  end if;

  if p_account_id is null or length(trim(p_account_id)) = 0 then
    return jsonb_build_object('code', 'invalid_ledger_reference');
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

  if p_category_id is not null and length(trim(p_category_id)) = 0 then
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

  select ledger.transactions.*
  into v_existing_transaction
  from ledger.transactions
  where ledger.transactions.user_id = p_user_id
    and ledger.transactions.id = p_transaction_id
    and ledger.transactions.deleted_at is null
  for update;

  if not found
    or v_existing_transaction.record_version is distinct from p_expected_record_version
  then
    return jsonb_build_object('code', 'stale_expected_version');
  end if;

  if v_existing_transaction.type = p_type
    and v_existing_transaction.amount = p_amount
    and v_existing_transaction.currency = p_currency
    and v_existing_transaction.category_id is not distinct from p_category_id
    and v_existing_transaction.account_id = p_account_id
    and v_existing_transaction.description is not distinct from p_description
    and v_existing_transaction.date = p_date
  then
    return jsonb_build_object(
      'code', 'accepted',
      'transaction', ledger.accepted_transaction_payload(v_existing_transaction),
      'cursor', 'ledger:' || v_existing_transaction.cursor_sequence::text
    );
  end if;

  select ledger.ledger_cursors.latest_sequence + 1
  into v_next_sequence
  from ledger.ledger_cursors
  where ledger.ledger_cursors.user_id = p_user_id
  for update;

  update ledger.transactions
  set type = p_type,
      amount = p_amount,
      currency = p_currency,
      category_id = p_category_id,
      account_id = p_account_id,
      description = p_description,
      date = p_date,
      record_version = v_existing_transaction.record_version + 1,
      cursor_sequence = v_next_sequence,
      updated_at = v_updated_at
  where ledger.transactions.user_id = p_user_id
    and ledger.transactions.id = p_transaction_id
  returning ledger.transactions.*
  into v_new_transaction;

  insert into ledger.transaction_edit_history (
    user_id,
    change_id,
    action,
    transaction_id,
    previous_record_version,
    new_record_version,
    previous_payload,
    new_payload,
    cursor_sequence,
    created_at
  ) values (
    p_user_id,
    p_change_id,
    'amend',
    p_transaction_id,
    v_existing_transaction.record_version,
    v_new_transaction.record_version,
    ledger.transaction_payload(v_existing_transaction),
    ledger.transaction_payload(v_new_transaction),
    v_next_sequence,
    v_updated_at
  ) on conflict (user_id, change_id) do nothing;

  update ledger.ledger_cursors
  set latest_sequence = v_next_sequence,
      updated_at = v_updated_at
  where ledger.ledger_cursors.user_id = p_user_id;

  v_old_month := to_char(v_existing_transaction.date, 'YYYY-MM');
  v_new_month := to_char(p_date, 'YYYY-MM');
  perform ledger.rebuild_transaction_monthly_total(p_user_id, v_old_month, v_next_sequence);
  if v_new_month <> v_old_month then
    perform ledger.rebuild_transaction_monthly_total(p_user_id, v_new_month, v_next_sequence);
  end if;

  return jsonb_build_object(
    'code', 'accepted',
    'transaction', ledger.accepted_transaction_payload(v_new_transaction),
    'cursor', 'ledger:' || v_next_sequence::text
  );
exception
  when unique_violation then
    return jsonb_build_object('code', 'duplicate_idempotency_key');
  when foreign_key_violation then
    return jsonb_build_object('code', 'invalid_ledger_reference');
  when check_violation or not_null_violation then
    return jsonb_build_object('code', 'invalid_transaction');
end;
$$;

revoke execute on function ledger.apply_transaction_amend(
  uuid,
  integer,
  text,
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

create or replace function ledger.apply_transaction_delete(
  p_user_id uuid,
  p_command_version integer,
  p_change_id text,
  p_expected_record_version integer,
  p_transaction_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_transaction ledger.transactions%rowtype;
  v_next_sequence bigint;
  v_new_transaction ledger.transactions%rowtype;
  v_old_month text;
  v_updated_at timestamptz := now();
begin
  if p_command_version is distinct from 1 then
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
    and ledger.transactions.id = p_transaction_id
    and ledger.transactions.deleted_at is null
  for update;

  if not found
    or v_existing_transaction.record_version is distinct from p_expected_record_version
  then
    return jsonb_build_object('code', 'stale_expected_version');
  end if;

  select ledger.ledger_cursors.latest_sequence + 1
  into v_next_sequence
  from ledger.ledger_cursors
  where ledger.ledger_cursors.user_id = p_user_id
  for update;

  update ledger.transactions
  set deleted_at = v_updated_at,
      record_version = v_existing_transaction.record_version + 1,
      cursor_sequence = v_next_sequence,
      updated_at = v_updated_at
  where ledger.transactions.user_id = p_user_id
    and ledger.transactions.id = p_transaction_id
  returning ledger.transactions.*
  into v_new_transaction;

  insert into ledger.tombstones (
    user_id,
    record_type,
    record_id,
    cursor_sequence,
    deleted_at
  ) values (
    p_user_id,
    'transaction',
    p_transaction_id,
    v_next_sequence,
    v_updated_at
  ) on conflict (user_id, record_type, record_id) do update set
    cursor_sequence = excluded.cursor_sequence,
    deleted_at = excluded.deleted_at;

  insert into ledger.transaction_edit_history (
    user_id,
    change_id,
    action,
    transaction_id,
    previous_record_version,
    new_record_version,
    previous_payload,
    new_payload,
    cursor_sequence,
    created_at
  ) values (
    p_user_id,
    p_change_id,
    'delete',
    p_transaction_id,
    v_existing_transaction.record_version,
    v_new_transaction.record_version,
    ledger.transaction_payload(v_existing_transaction),
    null,
    v_next_sequence,
    v_updated_at
  ) on conflict (user_id, change_id) do nothing;

  update ledger.ledger_cursors
  set latest_sequence = v_next_sequence,
      updated_at = v_updated_at
  where ledger.ledger_cursors.user_id = p_user_id;

  v_old_month := to_char(v_existing_transaction.date, 'YYYY-MM');
  perform ledger.rebuild_transaction_monthly_total(p_user_id, v_old_month, v_next_sequence);

  return jsonb_build_object(
    'code', 'accepted',
    'transactionId', p_transaction_id,
    'tombstone', jsonb_build_object(
      'recordType', 'transaction',
      'recordId', p_transaction_id,
      'deletedAt', to_char(v_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'cursor', 'ledger:' || v_next_sequence::text
  );
exception
  when foreign_key_violation then
    return jsonb_build_object('code', 'invalid_ledger_reference');
  when check_violation or not_null_violation then
    return jsonb_build_object('code', 'invalid_transaction');
end;
$$;

revoke execute on function ledger.apply_transaction_delete(
  uuid,
  integer,
  text,
  integer,
  text
) from public, anon, authenticated;

create or replace function public.cloud_ledger_apply_pending_changes(
  p_user_id uuid,
  p_command_version integer,
  p_device_id text,
  p_batch_id text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accepted_change_ids text[] := array[]::text[];
  v_change jsonb;
  v_change_id text;
  v_change_kind text;
  v_change_outcomes jsonb := '[]'::jsonb;
  v_cursor text := 'ledger:0';
  v_cursor_sequence bigint := 0;
  v_existing_acceptance ledger.pending_change_acceptances%rowtype;
  v_existing_change_acceptance ledger.pending_change_acceptances%rowtype;
  v_expected_record_version integer;
  v_idempotency_key text;
  v_outcome jsonb;
  v_payload_fingerprint text;
  v_record_id text;
  v_repair_code text;
  v_rejected_change_ids text[] := array[]::text[];
  v_seen_change_ids text[] := array[]::text[];
  v_seen_idempotency_keys text[] := array[]::text[];
begin
  if p_command_version is distinct from 1 then
    select coalesce(
      jsonb_agg(
        ledger.pending_change_outcome(
          value ->> 'id',
          'requires_app_update',
          'unsupported_command_version'
        )
        order by ordinality
      ),
      '[]'::jsonb
    )
    into v_change_outcomes
    from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) with ordinality;

    select coalesce(array_agg(value ->> 'id' order by ordinality), array[]::text[])
    into v_rejected_change_ids
    from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) with ordinality;

    return jsonb_build_object(
      'code', 'accepted',
      'acceptedChangeIds', to_jsonb(v_accepted_change_ids),
      'rejectedChangeIds', to_jsonb(v_rejected_change_ids),
      'changeOutcomes', v_change_outcomes,
      'cursor', v_cursor
    );
  end if;

  if p_device_id is null
    or length(trim(p_device_id)) = 0
    or p_batch_id is null
    or length(trim(p_batch_id)) = 0
    or p_changes is null
    or jsonb_typeof(p_changes) <> 'array'
  then
    return jsonb_build_object(
      'code', 'accepted',
      'acceptedChangeIds', to_jsonb(v_accepted_change_ids),
      'rejectedChangeIds', to_jsonb(v_rejected_change_ids),
      'changeOutcomes', v_change_outcomes,
      'cursor', v_cursor
    );
  end if;

  for v_change in
    select value
    from jsonb_array_elements(p_changes) with ordinality
    order by ordinality
  loop
    v_change_id := v_change ->> 'id';
    v_change_kind := v_change ->> 'kind';
    v_idempotency_key := v_change ->> 'idempotencyKey';
    v_record_id := case
      when v_change_kind = 'deleteTransaction' then v_change ->> 'transactionId'
      else v_change #>> '{transaction,id}'
    end;
    v_payload_fingerprint := case
      when v_change_kind = 'deleteTransaction' then
        md5(jsonb_build_object('transactionId', v_record_id)::text)
      else md5((v_change -> 'transaction')::text)
    end;

    if v_change_id is not null then
      if v_change_id = any(v_seen_change_ids) then
        v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
        v_change_outcomes := v_change_outcomes || jsonb_build_array(
          ledger.pending_change_outcome(
            v_change_id,
            'repair_required',
            'duplicate_change_id'
          )
        );
        continue;
      end if;
      v_seen_change_ids := array_append(v_seen_change_ids, v_change_id);
    end if;

    if v_idempotency_key is not null then
      if v_idempotency_key = any(v_seen_idempotency_keys) then
        v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
        v_change_outcomes := v_change_outcomes || jsonb_build_array(
          ledger.pending_change_outcome(
            v_change_id,
            'repair_required',
            'duplicate_idempotency_key'
          )
        );
        continue;
      end if;
      v_seen_idempotency_keys := array_append(v_seen_idempotency_keys, v_idempotency_key);
    end if;

    if v_change_kind = 'invalidPendingChange'
      and nullif(v_change ->> 'commandVersion', '')::integer = 1
    then
      v_repair_code := case
        when v_change ->> 'invalidCode' in (
          'invalid_ledger_reference',
          'invalid_transaction',
          'invalid_transaction_id'
        )
        then v_change ->> 'invalidCode'
        else 'invalid_transaction'
      end;
      v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
      v_change_outcomes := v_change_outcomes || jsonb_build_array(
        ledger.pending_change_outcome(v_change_id, 'repair_required', v_repair_code)
      );
      continue;
    end if;

    if v_change_kind not in ('createTransaction', 'amendTransaction', 'deleteTransaction')
      or nullif(v_change ->> 'commandVersion', '')::integer is distinct from 1
    then
      v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
      v_change_outcomes := v_change_outcomes || jsonb_build_array(
        ledger.pending_change_outcome(
          v_change_id,
          'requires_app_update',
          'unsupported_command_version'
        )
      );
      continue;
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(coalesce(v_change -> 'dependencies', '[]'::jsonb)) as dependencies(change_id)
      where dependencies.change_id = any(v_rejected_change_ids)
        or not (
          dependencies.change_id = any(v_accepted_change_ids)
          or exists (
            select 1
            from ledger.pending_change_acceptances
            where ledger.pending_change_acceptances.user_id = p_user_id
              and ledger.pending_change_acceptances.change_id = dependencies.change_id
          )
        )
    ) then
      v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
      v_change_outcomes := v_change_outcomes || jsonb_build_array(
        ledger.pending_change_outcome(v_change_id, 'repair_required', 'dependency_failed')
      );
      continue;
    end if;

    perform pg_advisory_xact_lock(
      hashtext('cloud_ledger_pending_change'),
      hashtext(p_user_id::text || ':' || v_idempotency_key)
    );
    perform pg_advisory_xact_lock(
      hashtext('cloud_ledger_pending_change_id'),
      hashtext(p_user_id::text || ':' || v_change_id)
    );

    select ledger.pending_change_acceptances.*
    into v_existing_acceptance
    from ledger.pending_change_acceptances
    where ledger.pending_change_acceptances.user_id = p_user_id
      and ledger.pending_change_acceptances.idempotency_key = v_idempotency_key;

    if found then
      if v_existing_acceptance.change_id <> v_change_id
        or v_existing_acceptance.record_type is distinct from 'transaction'
        or v_existing_acceptance.record_id is distinct from v_record_id
        or v_existing_acceptance.payload_fingerprint is distinct from v_payload_fingerprint
      then
        v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
        v_change_outcomes := v_change_outcomes || jsonb_build_array(
          ledger.pending_change_outcome(
            v_change_id,
            'repair_required',
            'duplicate_idempotency_key'
          )
        );
        continue;
      end if;

      v_accepted_change_ids := array_append(v_accepted_change_ids, v_change_id);
      v_cursor_sequence := greatest(v_cursor_sequence, v_existing_acceptance.cursor_sequence);
      v_cursor := 'ledger:' || v_cursor_sequence::text;
      v_change_outcomes := v_change_outcomes || jsonb_build_array(
        ledger.pending_change_outcome(v_change_id, 'accepted', 'accepted')
      );
      continue;
    end if;

    select ledger.pending_change_acceptances.*
    into v_existing_change_acceptance
    from ledger.pending_change_acceptances
    where ledger.pending_change_acceptances.user_id = p_user_id
      and ledger.pending_change_acceptances.change_id = v_change_id;

    if found then
      v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
      v_change_outcomes := v_change_outcomes || jsonb_build_array(
        ledger.pending_change_outcome(v_change_id, 'repair_required', 'duplicate_change_id')
      );
      continue;
    end if;

    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_change -> 'expectedVersions', '[]'::jsonb)) as expected_versions(version_guard)
      where expected_versions.version_guard ->> 'recordType' = 'transaction'
        and not exists (
          select 1
          from ledger.transactions
          where ledger.transactions.user_id = p_user_id
            and ledger.transactions.id = expected_versions.version_guard ->> 'recordId'
            and ledger.transactions.record_version =
              nullif(expected_versions.version_guard ->> 'version', '')::integer
            and ledger.transactions.deleted_at is null
        )
    ) then
      v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
      v_change_outcomes := v_change_outcomes || jsonb_build_array(
        ledger.pending_change_outcome(v_change_id, 'repair_required', 'stale_expected_version')
      );
      continue;
    end if;

    if v_change_kind in ('amendTransaction', 'deleteTransaction') then
      select nullif(expected_versions.version_guard ->> 'version', '')::integer
      into v_expected_record_version
      from jsonb_array_elements(coalesce(v_change -> 'expectedVersions', '[]'::jsonb)) as expected_versions(version_guard)
      where expected_versions.version_guard ->> 'recordType' = 'transaction'
        and expected_versions.version_guard ->> 'recordId' = v_record_id
      limit 1;

      if v_expected_record_version is null then
        v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
        v_change_outcomes := v_change_outcomes || jsonb_build_array(
          ledger.pending_change_outcome(v_change_id, 'repair_required', 'stale_expected_version')
        );
        continue;
      end if;
    end if;

    if v_change_kind = 'createTransaction' then
      v_outcome := public.cloud_ledger_create_transaction(
        p_user_id,
        1,
        v_record_id,
        v_change #>> '{transaction,type}',
        nullif(v_change #>> '{transaction,amount}', '')::integer,
        v_change #>> '{transaction,currency}',
        v_change #>> '{transaction,categoryId}',
        v_change #>> '{transaction,accountId}',
        v_change #>> '{transaction,description}',
        nullif(v_change #>> '{transaction,date}', '')::date
      );
    elsif v_change_kind = 'amendTransaction' then
      v_outcome := ledger.apply_transaction_amend(
        p_user_id,
        1,
        v_change_id,
        v_expected_record_version,
        v_record_id,
        v_change #>> '{transaction,type}',
        nullif(v_change #>> '{transaction,amount}', '')::integer,
        v_change #>> '{transaction,currency}',
        v_change #>> '{transaction,categoryId}',
        v_change #>> '{transaction,accountId}',
        v_change #>> '{transaction,description}',
        nullif(v_change #>> '{transaction,date}', '')::date
      );
    else
      v_outcome := ledger.apply_transaction_delete(
        p_user_id,
        1,
        v_change_id,
        v_expected_record_version,
        v_record_id
      );
    end if;

    if v_outcome ->> 'code' = 'accepted' then
      v_accepted_change_ids := array_append(v_accepted_change_ids, v_change_id);
      v_cursor_sequence := greatest(
        v_cursor_sequence,
        replace(v_outcome ->> 'cursor', 'ledger:', '')::bigint
      );
      v_cursor := 'ledger:' || v_cursor_sequence::text;
      insert into ledger.pending_change_acceptances (
        user_id,
        idempotency_key,
        device_id,
        batch_id,
        change_id,
        status,
        outcome_code,
        record_type,
        record_id,
        payload_fingerprint,
        cursor_sequence
      ) values (
        p_user_id,
        v_idempotency_key,
        p_device_id,
        p_batch_id,
        v_change_id,
        'accepted',
        'accepted',
        'transaction',
        v_record_id,
        v_payload_fingerprint,
        replace(v_cursor, 'ledger:', '')::bigint
      )
      on conflict (user_id, idempotency_key) do nothing;
      v_change_outcomes := v_change_outcomes || jsonb_build_array(
        ledger.pending_change_outcome(v_change_id, 'accepted', 'accepted')
      );
    else
      v_rejected_change_ids := array_append(v_rejected_change_ids, v_change_id);
      v_change_outcomes := v_change_outcomes || jsonb_build_array(
        ledger.pending_change_outcome(v_change_id, 'repair_required', v_outcome ->> 'code')
      );
    end if;
  end loop;

  return jsonb_build_object(
    'code', 'accepted',
    'acceptedChangeIds', to_jsonb(v_accepted_change_ids),
    'rejectedChangeIds', to_jsonb(v_rejected_change_ids),
    'changeOutcomes', v_change_outcomes,
    'cursor', v_cursor
  );
exception
  when invalid_text_representation or datetime_field_overflow then
    return jsonb_build_object(
      'code', 'accepted',
      'acceptedChangeIds', to_jsonb(v_accepted_change_ids),
      'rejectedChangeIds', to_jsonb(v_rejected_change_ids),
      'changeOutcomes', v_change_outcomes,
      'cursor', v_cursor
    );
end;
$$;

revoke execute on function public.cloud_ledger_apply_pending_changes(
  uuid,
  integer,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.cloud_ledger_apply_pending_changes(
  uuid,
  integer,
  text,
  text,
  jsonb
) to service_role;

revoke all on table ledger.transaction_edit_history from public, anon, authenticated;
