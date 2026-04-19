alter table public.transactions
  add column account_id text;

update public.transactions
set account_id = 'fa-default-' || user_id::text
where account_id is null;

alter table public.transactions
  alter column account_id set not null;

alter table public.transactions
  add column account_attribution_state text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'source'
  ) then
    execute $sql$
      update public.transactions
      set account_attribution_state = case
        when coalesce(source, 'manual') = 'manual' then 'confirmed'
        else 'unresolved'
      end
      where account_attribution_state is null
    $sql$;
  else
    update public.transactions
    set account_attribution_state = 'unresolved'
    where account_attribution_state is null;
  end if;
end $$;

alter table public.transactions
  alter column account_attribution_state set not null;

alter table public.transactions
  add constraint transactions_account_attribution_state_check
  check (account_attribution_state in ('confirmed', 'inferred', 'unresolved'));

alter table public.transactions
  add column superseded_at text;

create index idx_transactions_user_account_date
  on public.transactions (user_id, account_id, date);
