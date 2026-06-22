create extension if not exists pgcrypto with schema extensions;

drop policy if exists "Users can insert own notification parse improvement samples"
  on public.notification_parse_improvement_samples;

revoke insert, update, delete on public.notification_parse_improvement_samples from anon, authenticated;

create or replace function public.cloud_ledger_retain_capture_improvement_sample(
  p_user_id uuid,
  p_source_channel text,
  p_source_family text,
  p_provider_category text,
  p_template_shape text,
  p_parse_outcome text,
  p_confidence_bucket text,
  p_extractor_method text,
  p_extractor_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text;
begin
  if p_user_id is null
    or p_source_channel not in ('email', 'notification', 'wallet')
    or p_source_family not in ('email', 'android_notification', 'wallet_notification')
    or p_provider_category not in ('bank', 'payment_app', 'wallet', 'unknown')
    or p_template_shape is null
    or length(trim(p_template_shape)) = 0
    or length(p_template_shape) > 1000
    or p_parse_outcome not in ('failed', 'needs_review')
    or p_confidence_bucket not in ('none', 'low', 'medium', 'high')
    or p_extractor_method not in ('regex', 'llm')
    or p_extractor_version is distinct from 1
  then
    return jsonb_build_object('code', 'invalid_capture_improvement_sample');
  end if;

  v_source := case
    when p_source_channel = 'email' then 'email_gmail'
    when p_source_channel = 'wallet' then 'google_pay'
    else 'notification_android'
  end;

  insert into public.notification_parse_improvement_samples (
    user_id,
    source,
    sender_domain,
    status,
    confidence_bucket,
    parse_method,
    template,
    template_hash,
    review_status
  ) values (
    p_user_id,
    v_source,
    null,
    p_parse_outcome,
    p_confidence_bucket,
    p_extractor_method,
    trim(p_template_shape),
    encode(extensions.digest(trim(p_template_shape), 'sha256'), 'hex'),
    'pending'
  );

  return jsonb_build_object('code', 'accepted');
end;
$$;

create or replace function public.cloud_ledger_delete_capture_improvement_samples(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notification_parse_improvement_samples
  where notification_parse_improvement_samples.user_id = p_user_id;

  return jsonb_build_object('code', 'accepted');
end;
$$;

revoke execute on function public.cloud_ledger_retain_capture_improvement_sample(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer
) from public, anon, authenticated;

grant execute on function public.cloud_ledger_retain_capture_improvement_sample(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer
) to service_role;

revoke execute on function public.cloud_ledger_delete_capture_improvement_samples(uuid) from public, anon, authenticated;

grant execute on function public.cloud_ledger_delete_capture_improvement_samples(uuid) to service_role;
