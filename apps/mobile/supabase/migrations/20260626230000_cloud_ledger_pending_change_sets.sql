create table if not exists ledger.pending_change_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  device_id text not null check (length(trim(device_id)) > 0),
  batch_id text not null check (length(trim(batch_id)) > 0),
  change_id text not null check (length(trim(change_id)) > 0),
  status text not null check (status = 'accepted'),
  outcome_code text not null check (outcome_code = 'accepted'),
  record_type text check (record_type is null or record_type in ('transaction')),
  record_id text check (record_id is null or length(trim(record_id)) > 0),
  payload_fingerprint text not null check (length(payload_fingerprint) = 32),
  cursor_sequence bigint not null check (cursor_sequence >= 0),
  accepted_at timestamptz not null default now(),
  primary key (user_id, idempotency_key),
  unique (user_id, change_id)
);

alter table ledger.pending_change_acceptances enable row level security;
alter table ledger.pending_change_acceptances force row level security;

create or replace function ledger.pending_change_outcome(
  p_change_id text,
  p_status text,
  p_code text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'changeId', p_change_id,
    'status', p_status,
    'code', p_code
  );
$$;

revoke execute on function ledger.pending_change_outcome(text, text, text)
  from public, anon, authenticated;

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
  v_change_outcomes jsonb := '[]'::jsonb;
  v_cursor text := 'ledger:0';
  v_cursor_sequence bigint := 0;
  v_existing_acceptance ledger.pending_change_acceptances%rowtype;
  v_existing_change_acceptance ledger.pending_change_acceptances%rowtype;
  v_idempotency_key text;
  v_outcome jsonb;
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
    v_idempotency_key := v_change ->> 'idempotencyKey';

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

    if v_change ->> 'kind' = 'invalidPendingChange'
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

    if v_change ->> 'kind' <> 'createTransaction'
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
        or v_existing_acceptance.record_id is distinct from v_change #>> '{transaction,id}'
        or v_existing_acceptance.payload_fingerprint is distinct from
          md5((v_change -> 'transaction')::text)
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

    v_outcome := public.cloud_ledger_create_transaction(
      p_user_id,
      1,
      v_change #>> '{transaction,id}',
      v_change #>> '{transaction,type}',
      nullif(v_change #>> '{transaction,amount}', '')::integer,
      v_change #>> '{transaction,currency}',
      v_change #>> '{transaction,categoryId}',
      v_change #>> '{transaction,accountId}',
      v_change #>> '{transaction,description}',
      nullif(v_change #>> '{transaction,date}', '')::date
    );

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
        v_change #>> '{transaction,id}',
        md5((v_change -> 'transaction')::text),
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

revoke all on table ledger.pending_change_acceptances from public, anon, authenticated;
