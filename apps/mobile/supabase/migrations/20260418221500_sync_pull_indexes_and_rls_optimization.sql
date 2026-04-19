create index if not exists idx_transactions_user_updated_id
  on public.transactions (user_id, updated_at, id);

create index if not exists idx_financial_accounts_user_updated_id
  on public.financial_accounts (user_id, updated_at, id);

create index if not exists idx_transfers_user_updated_id
  on public.transfers (user_id, updated_at, id);

create index if not exists idx_opening_balances_user_updated_id
  on public.opening_balances (user_id, updated_at, id);

create index if not exists idx_financial_account_identifiers_user_updated_id
  on public.financial_account_identifiers (user_id, updated_at, id);

drop policy if exists "Users can read own financial accounts" on public.financial_accounts;
create policy "Users can read own financial accounts"
  on public.financial_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own financial accounts" on public.financial_accounts;
create policy "Users can insert own financial accounts"
  on public.financial_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own financial accounts" on public.financial_accounts;
create policy "Users can update own financial accounts"
  on public.financial_accounts for update to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own financial accounts" on public.financial_accounts;
create policy "Users can delete own financial accounts"
  on public.financial_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own transfers" on public.transfers;
create policy "Users can read own transfers"
  on public.transfers for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own transfers" on public.transfers;
create policy "Users can insert own transfers"
  on public.transfers for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own transfers" on public.transfers;
create policy "Users can update own transfers"
  on public.transfers for update to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own transfers" on public.transfers;
create policy "Users can delete own transfers"
  on public.transfers for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own opening balances" on public.opening_balances;
create policy "Users can read own opening balances"
  on public.opening_balances for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own opening balances" on public.opening_balances;
create policy "Users can insert own opening balances"
  on public.opening_balances for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own opening balances" on public.opening_balances;
create policy "Users can update own opening balances"
  on public.opening_balances for update to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own opening balances" on public.opening_balances;
create policy "Users can delete own opening balances"
  on public.opening_balances for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own financial account identifiers" on public.financial_account_identifiers;
create policy "Users can read own financial account identifiers"
  on public.financial_account_identifiers for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own financial account identifiers" on public.financial_account_identifiers;
create policy "Users can insert own financial account identifiers"
  on public.financial_account_identifiers for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own financial account identifiers" on public.financial_account_identifiers;
create policy "Users can update own financial account identifiers"
  on public.financial_account_identifiers for update to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own financial account identifiers" on public.financial_account_identifiers;
create policy "Users can delete own financial account identifiers"
  on public.financial_account_identifiers for delete to authenticated
  using ((select auth.uid()) = user_id);
