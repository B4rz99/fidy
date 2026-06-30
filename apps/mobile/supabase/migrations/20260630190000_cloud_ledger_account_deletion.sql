create or replace function public.cloud_ledger_delete_account_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return jsonb_build_object('code', 'invalid_account');
  end if;

  perform pg_advisory_xact_lock(
    hashtext('cloud_ledger_account_deletion'),
    hashtext(p_user_id::text)
  );

  delete from ledger.transaction_edit_history
  where ledger.transaction_edit_history.user_id = p_user_id;

  delete from ledger.pending_change_acceptances
  where ledger.pending_change_acceptances.user_id = p_user_id;

  delete from ledger.transaction_monthly_totals
  where ledger.transaction_monthly_totals.user_id = p_user_id;

  delete from ledger.tombstones
  where ledger.tombstones.user_id = p_user_id;

  delete from ledger.transactions
  where ledger.transactions.user_id = p_user_id;

  delete from ledger.categories
  where ledger.categories.user_id = p_user_id;

  delete from ledger.financial_accounts
  where ledger.financial_accounts.user_id = p_user_id;

  delete from ledger.ledger_cursors
  where ledger.ledger_cursors.user_id = p_user_id;

  return jsonb_build_object('code', 'deleted');
end;
$$;

revoke execute on function public.cloud_ledger_delete_account_data(uuid)
  from public, anon, authenticated;
grant execute on function public.cloud_ledger_delete_account_data(uuid)
  to service_role;
