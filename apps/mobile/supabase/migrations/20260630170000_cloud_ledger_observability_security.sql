do $$
begin
  create role ledger_api nologin;
exception
  when duplicate_object then
    null;
end
$$;

grant usage on schema public to ledger_api;

revoke all on schema ledger from ledger_api;
revoke all on all tables in schema ledger from ledger_api;
revoke all on all sequences in schema ledger from ledger_api;
alter default privileges in schema ledger revoke all on tables from ledger_api;
alter default privileges in schema ledger revoke all on sequences from ledger_api;
alter default privileges revoke execute on functions from public, anon, authenticated, ledger_api;
alter default privileges in schema ledger revoke execute on functions from public, anon, authenticated, ledger_api;

grant execute on function public.cloud_ledger_bootstrap(uuid, bigint) to ledger_api;
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
) to ledger_api;
grant execute on function public.cloud_ledger_apply_pending_changes(
  uuid,
  integer,
  text,
  text,
  jsonb
) to ledger_api;

grant execute on function public.cloud_ledger_bootstrap(uuid, bigint) to service_role;
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
grant execute on function public.cloud_ledger_apply_pending_changes(
  uuid,
  integer,
  text,
  text,
  jsonb
) to service_role;

do $$
begin
  if to_regprocedure(
    'public.cloud_ledger_retain_capture_improvement_sample(uuid,text,text,text,text,text,text,text,text,integer)'
  ) is not null then
    execute 'grant execute on function public.cloud_ledger_retain_capture_improvement_sample(
      uuid,
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      integer
    ) to ledger_api';
    execute 'grant execute on function public.cloud_ledger_retain_capture_improvement_sample(
      uuid,
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      text,
      integer
    ) to service_role';
  end if;

  if to_regprocedure('public.cloud_ledger_delete_capture_improvement_samples(uuid)') is not null then
    execute 'grant execute on function public.cloud_ledger_delete_capture_improvement_samples(uuid) to ledger_api';
    execute 'grant execute on function public.cloud_ledger_delete_capture_improvement_samples(uuid) to service_role';
  end if;

  if to_regprocedure(
    'public.cloud_ledger_set_capture_improvement_preference(uuid,boolean)'
  ) is not null then
    execute 'grant execute on function public.cloud_ledger_set_capture_improvement_preference(uuid, boolean) to ledger_api';
    execute 'grant execute on function public.cloud_ledger_set_capture_improvement_preference(uuid, boolean) to service_role';
  end if;
end
$$;

revoke execute on all functions in schema ledger from public, anon, authenticated, ledger_api;
