import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622090000_cloud_ledger_bootstrap.sql"
);
const CREATE_TRANSACTION_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622100000_cloud_ledger_transaction_create.sql"
);
const PENDING_CHANGE_SET_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260626230000_cloud_ledger_pending_change_sets.sql"
);
const TRANSACTION_EDIT_DELETE_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260630153000_cloud_ledger_transaction_edit_delete.sql"
);
const OBSERVABILITY_SECURITY_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260630170000_cloud_ledger_observability_security.sql"
);
const ACCOUNT_DELETION_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260630190000_cloud_ledger_account_deletion.sql"
);
const CAPTURE_IMPROVEMENT_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622110000_capture_improvement_sample_boundary.sql"
);
const CAPTURE_IMPROVEMENT_SENDER_DOMAIN_SCRUB_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622230000_capture_improvement_sender_domain_scrub.sql"
);
const CAPTURE_IMPROVEMENT_OPT_OUT_SERIALIZATION_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260623170000_capture_improvement_opt_out_serialization.sql"
);
const CAPTURE_IMPROVEMENT_SOURCE_PROVIDER_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260623223000_capture_improvement_source_provider.sql"
);

describe("Cloud Ledger remote schema", () => {
  it("creates bootstrap financial tables in a non-exposed ledger schema", () => {
    const sql = readFileSync(MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("create schema if not exists ledger");
    expect(sql).toContain("create table if not exists ledger.categories");
    expect(sql).toContain("create table if not exists ledger.financial_accounts");
    expect(sql).toContain("create table if not exists ledger.transactions");
    expect(sql).toContain("create table if not exists ledger.tombstones");
    expect(sql).toContain("create table if not exists ledger.ledger_cursors");
    expect(sql).not.toMatch(
      /create table(?: if not exists)? public\.(categories|financial_accounts|transactions)/
    );
  });

  it("keeps client roles from direct table access to the ledger schema", () => {
    const sql = readFileSync(MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("revoke usage on schema ledger from anon, authenticated");
    expect(sql).toContain("revoke all on all tables in schema ledger from anon, authenticated");
    expect(sql).toContain(
      "alter default privileges in schema ledger revoke all on tables from anon, authenticated"
    );
  });

  it("rejects blank ledger identifiers before they can reach the mobile parser", () => {
    const sql = readFileSync(MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("id text not null check (length(trim(id)) > 0)");
    expect(sql).toContain(
      "category_id text check (category_id is null or length(trim(category_id)) > 0)"
    );
    expect(sql).toContain("account_id text not null check (length(trim(account_id)) > 0)");
    expect(sql).toContain("record_id text not null check (length(trim(record_id)) > 0)");
  });

  it("exposes bootstrap data only through a service-role Remote API Boundary function", () => {
    const sql = readFileSync(MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("create or replace function public.cloud_ledger_bootstrap");
    expect(sql).toContain("'tombstones', tombstone_rows.rows");
    expect(sql).toContain(
      "revoke execute on function public.cloud_ledger_bootstrap(uuid, bigint) from public, anon, authenticated"
    );
    expect(sql).toContain(
      "grant execute on function public.cloud_ledger_bootstrap(uuid, bigint) to service_role"
    );
  });

  it("exposes transaction creates only through a service-role command and rebuildable projection", () => {
    const sql = readFileSync(CREATE_TRANSACTION_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("create table if not exists ledger.transaction_monthly_totals");
    expect(sql).toContain("create or replace function ledger.rebuild_transaction_monthly_total");
    expect(sql).toContain("create or replace function public.cloud_ledger_create_transaction");
    expect(sql).toContain("ledger_transactions_amount_positive check (amount > 0)");
    expect(sql).toContain("ledger_transactions_date_not_future check (date <= current_date)");
    expect(sql).toMatch(
      /revoke execute on function public\.cloud_ledger_create_transaction\([\s\S]*?date\s*\) from public, anon, authenticated/
    );
    expect(sql).toMatch(
      /grant execute on function public\.cloud_ledger_create_transaction\([\s\S]*?date\s*\) to service_role/
    );
  });

  it("validates Cloud Ledger transaction fields before seeding missing references", () => {
    const sql = readFileSync(CREATE_TRANSACTION_MIGRATION, "utf8").toLowerCase();
    const validationIndex = sql.search(/p_amount is null\s+or p_amount <= 0/);
    const cursorSeedIndex = sql.indexOf("insert into ledger.ledger_cursors");
    const accountSeedIndex = sql.indexOf("v_should_seed_account := true");

    expect(validationIndex).toBeGreaterThanOrEqual(0);
    expect(validationIndex).toBeLessThan(cursorSeedIndex);
    expect(validationIndex).toBeLessThan(accountSeedIndex);
  });

  it("exposes Pending Change Set acceptance only through a service-role command", () => {
    const sql = readFileSync(PENDING_CHANGE_SET_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("create table if not exists ledger.pending_change_acceptances");
    expect(sql).toContain("primary key (user_id, idempotency_key)");
    expect(sql).toContain("alter table ledger.pending_change_acceptances force row level security");
    expect(sql).toContain("create or replace function ledger.pending_change_outcome");
    expect(sql).toContain(
      "revoke execute on function ledger.pending_change_outcome(text, text, text)"
    );
    expect(sql).toContain("create or replace function public.cloud_ledger_apply_pending_changes");
    expect(sql).toMatch(
      /revoke execute on function public\.cloud_ledger_apply_pending_changes\([\s\S]*?jsonb\s*\) from public, anon, authenticated/
    );
    expect(sql).toMatch(
      /grant execute on function public\.cloud_ledger_apply_pending_changes\([\s\S]*?jsonb\s*\) to service_role/
    );
    expect(sql).toContain(
      "revoke all on table ledger.pending_change_acceptances from public, anon, authenticated"
    );
  });

  it("guards Pending Change Set retries, dependencies, versions, and unsupported commands in Postgres", () => {
    const sql = readFileSync(PENDING_CHANGE_SET_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("idempotency_key = v_idempotency_key");
    expect(sql).toContain(
      "ledger.pending_change_outcome(v_change_id, 'repair_required', 'dependency_failed')"
    );
    expect(sql).toContain(
      "ledger.pending_change_outcome(v_change_id, 'repair_required', 'stale_expected_version')"
    );
    expect(sql).toContain("'requires_app_update'");
    expect(sql).toContain("'unsupported_command_version'");
    expect(sql).not.toContain("raise notice");
  });

  it("supports transaction amend/delete with tombstones and minimal edit history in Postgres", () => {
    const sql = readFileSync(TRANSACTION_EDIT_DELETE_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("create table if not exists ledger.transaction_edit_history");
    expect(sql).toContain("action text not null check (action in ('amend', 'delete'))");
    expect(sql).toContain("alter table ledger.transaction_edit_history force row level security");
    expect(sql).toContain("create or replace function ledger.apply_transaction_amend");
    expect(sql).toContain("create or replace function ledger.apply_transaction_delete");
    expect(sql).toContain("record_version = v_existing_transaction.record_version + 1");
    expect(sql).toContain("insert into ledger.tombstones");
    expect(sql).toContain("on conflict (user_id, record_type, record_id) do update");
    expect(sql).toContain("insert into ledger.transaction_edit_history");
    expect(sql).toContain(
      "v_change_kind not in ('createtransaction', 'amendtransaction', 'deletetransaction')"
    );
    expect(sql).toContain(
      "ledger.pending_change_outcome(v_change_id, 'repair_required', 'stale_expected_version')"
    );
    expect(sql).toContain("revoke execute on function ledger.apply_transaction_amend");
    expect(sql).toContain("revoke execute on function ledger.apply_transaction_delete");
    expect(sql).toContain(
      "revoke all on table ledger.transaction_edit_history from public, anon, authenticated"
    );
    expect(sql).not.toContain("raise notice");
  });

  it("adds a narrow Cloud Ledger API role without direct ledger table privileges", () => {
    const sql = readFileSync(OBSERVABILITY_SECURITY_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("create role ledger_api nologin");
    expect(sql).toContain("grant ledger_api to authenticator");
    expect(sql).toContain("grant usage on schema public to ledger_api");
    expect(sql).toContain("revoke all on schema ledger from ledger_api");
    expect(sql).toContain("revoke all on all tables in schema ledger from ledger_api");
    expect(sql).toContain("revoke all on all sequences in schema ledger from ledger_api");
    expect(sql).toContain(
      "grant execute on function public.cloud_ledger_bootstrap(uuid, bigint) to ledger_api"
    );
    expect(sql).toMatch(
      /grant execute on function public\.cloud_ledger_create_transaction\([\s\S]*?date\s*\) to ledger_api/
    );
    expect(sql).toMatch(
      /grant execute on function public\.cloud_ledger_apply_pending_changes\([\s\S]*?jsonb\s*\) to ledger_api/
    );
    expect(sql).toMatch(
      /grant execute on function public\.cloud_ledger_retain_capture_improvement_sample\([\s\S]*?integer[\s\S]*?\) to ledger_api/
    );
    expect(sql).toContain(
      "grant execute on function public.cloud_ledger_delete_capture_improvement_samples(uuid) to ledger_api"
    );
    expect(sql).toContain(
      "grant execute on function public.cloud_ledger_set_capture_improvement_preference(uuid, boolean) to ledger_api"
    );
    expect(sql).toContain("to service_role");
    expect(sql).toContain(
      "revoke execute on all functions in schema ledger from public, anon, authenticated, ledger_api"
    );
    expect(sql).toContain(
      "alter default privileges revoke execute on functions from public, anon, authenticated, ledger_api"
    );
    expect(sql).toContain(
      "alter default privileges in schema ledger revoke execute on functions from public, anon, authenticated, ledger_api"
    );
    expect(sql).not.toContain("raise notice");
  });

  it("physically deletes Cloud Ledger account data only through a service-role command", () => {
    const sql = readFileSync(ACCOUNT_DELETION_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("create or replace function public.cloud_ledger_delete_account_data");
    expect(sql).toContain("delete from ledger.transaction_edit_history");
    expect(sql).toContain("delete from ledger.pending_change_acceptances");
    expect(sql).toContain("delete from ledger.transaction_monthly_totals");
    expect(sql).toContain("delete from ledger.tombstones");
    expect(sql).toContain("delete from ledger.transactions");
    expect(sql).toContain("delete from ledger.categories");
    expect(sql).toContain("delete from ledger.financial_accounts");
    expect(sql).toContain("delete from ledger.ledger_cursors");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/update\s+ledger\.[\s\S]*deleted_at/);
  });

  it("exposes Capture Improvement Sample retention and deletion only through service-role commands", () => {
    const sql = readFileSync(CAPTURE_IMPROVEMENT_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("create table if not exists public.capture_improvement_preferences");
    expect(sql).toContain("enabled boolean not null default true");
    expect(sql).toContain(
      "revoke all on public.capture_improvement_preferences from anon, authenticated"
    );
    expect(sql).toContain(
      'drop policy if exists "users can insert own notification parse improvement samples"'
    );
    expect(sql).toContain(
      "revoke insert, update, delete on public.notification_parse_improvement_samples from anon, authenticated"
    );
    expect(sql).toContain(
      "create or replace function public.cloud_ledger_retain_capture_improvement_sample"
    );
    expect(sql).toContain(
      "create or replace function public.cloud_ledger_delete_capture_improvement_samples"
    );
    expect(sql).toContain(
      "create or replace function public.cloud_ledger_set_capture_improvement_preference"
    );
    expect(sql).toMatch(
      /where capture_improvement_preferences\.user_id = p_user_id\s+and capture_improvement_preferences\.enabled = false/
    );
    expect(sql).toContain("do update set enabled = false");
    expect(sql).toMatch(
      /revoke execute on function public\.cloud_ledger_retain_capture_improvement_sample\([\s\S]*?integer\s*\) from public, anon, authenticated/
    );
    expect(sql).toMatch(
      /grant execute on function public\.cloud_ledger_retain_capture_improvement_sample\([\s\S]*?integer\s*\) to service_role/
    );
    expect(sql).toMatch(
      /revoke execute on function public\.cloud_ledger_delete_capture_improvement_samples\(uuid\) from public, anon, authenticated/
    );
    expect(sql).toMatch(
      /grant execute on function public\.cloud_ledger_delete_capture_improvement_samples\(uuid\) to service_role/
    );
    expect(sql).toMatch(
      /revoke execute on function public\.cloud_ledger_set_capture_improvement_preference\(uuid, boolean\) from public, anon, authenticated/
    );
    expect(sql).toMatch(
      /grant execute on function public\.cloud_ledger_set_capture_improvement_preference\(uuid, boolean\) to service_role/
    );
  });

  it("scrubs legacy Capture Improvement Sample sender domains into coarse provider category", () => {
    const sql = readFileSync(
      CAPTURE_IMPROVEMENT_SENDER_DOMAIN_SCRUB_MIGRATION,
      "utf8"
    ).toLowerCase();

    expect(sql).toContain(
      "add column if not exists provider_category text not null default 'unknown'"
    );
    expect(sql).toContain("provider_category in ('bank', 'payment_app', 'wallet', 'unknown')");
    expect(sql).toMatch(
      /update public\.notification_parse_improvement_samples[\s\S]*set[\s\S]*provider_category = case[\s\S]*sender_domain[\s\S]*sender_domain = null/
    );
    expect(sql).toContain(
      "drop index if exists public.idx_notification_parse_samples_sender_domain"
    );
    expect(sql).toContain(
      "create or replace function public.cloud_ledger_retain_capture_improvement_sample"
    );
    expect(sql).toMatch(
      /insert into public\.notification_parse_improvement_samples \([\s\S]*provider_category[\s\S]*\) values \([\s\S]*p_provider_category/
    );
    expect(sql).not.toMatch(/raw_text|raw_body|merchant_name|amount_value/u);
  });

  it("serializes Capture Improvement Sample retain and opt-out deletion for each user", () => {
    const sql = readFileSync(
      CAPTURE_IMPROVEMENT_OPT_OUT_SERIALIZATION_MIGRATION,
      "utf8"
    ).toLowerCase();
    const lockCall =
      "pg_advisory_xact_lock(hashtext('capture_improvement_samples'), hashtext(p_user_id::text))";

    expect(sql.match(/perform pg_advisory_xact_lock/g)).toHaveLength(3);
    expect(sql).toMatch(
      new RegExp(
        `create or replace function public\\.cloud_ledger_retain_capture_improvement_sample[\\s\\S]*perform ${escapeRegExp(lockCall)}[\\s\\S]*where capture_improvement_preferences\\.user_id = p_user_id[\\s\\S]*insert into public\\.notification_parse_improvement_samples`
      )
    );
    expect(sql).toMatch(
      new RegExp(
        `create or replace function public\\.cloud_ledger_delete_capture_improvement_samples[\\s\\S]*perform ${escapeRegExp(lockCall)}[\\s\\S]*insert into public\\.capture_improvement_preferences[\\s\\S]*delete from public\\.notification_parse_improvement_samples`
      )
    );
    expect(sql).toMatch(
      new RegExp(
        `create or replace function public\\.cloud_ledger_set_capture_improvement_preference[\\s\\S]*perform ${escapeRegExp(lockCall)}[\\s\\S]*insert into public\\.capture_improvement_preferences[\\s\\S]*if p_enabled = false then[\\s\\S]*delete from public\\.notification_parse_improvement_samples`
      )
    );
  });

  it("preserves coarse email source providers in the serialized retain RPC", () => {
    const sql = readFileSync(
      CAPTURE_IMPROVEMENT_OPT_OUT_SERIALIZATION_MIGRATION,
      "utf8"
    ).toLowerCase();
    const compactSql = sql.replace(/\s+/g, " ");

    expect(sql).toContain("p_source_provider text");
    expect(compactSql).toContain(
      "drop function if exists public.cloud_ledger_retain_capture_improvement_sample(uuid, text, text, text, text, text, text, text, integer)"
    );
    expect(compactSql).toContain(
      "when p_source_channel = 'email' and p_source_provider = 'outlook' then 'email_outlook'"
    );
    expect(compactSql).toContain(
      "when p_source_channel = 'email' and p_source_provider = 'gmail' then 'email_gmail'"
    );
  });

  it("preserves coarse email source providers when retaining Capture Improvement Samples", () => {
    const sql = readFileSync(CAPTURE_IMPROVEMENT_SOURCE_PROVIDER_MIGRATION, "utf8").toLowerCase();
    const compactSql = sql.replace(/\s+/g, " ");

    expect(sql).toContain("p_source_provider text");
    expect(sql).toContain(
      "p_source_provider is null or p_source_provider not in ('gmail', 'outlook')"
    );
    expect(compactSql).toContain(
      "when p_source_channel = 'email' and p_source_provider = 'outlook' then 'email_outlook'"
    );
    expect(compactSql).toContain(
      "when p_source_channel = 'email' and p_source_provider = 'gmail' then 'email_gmail'"
    );
    expect(compactSql).toContain(
      "drop function if exists public.cloud_ledger_retain_capture_improvement_sample(uuid, text, text, text, text, text, text, text, integer)"
    );
    expect(compactSql).toContain(
      "grant execute on function public.cloud_ledger_retain_capture_improvement_sample( uuid, text, text, text, text, text, text, text, text, integer ) to service_role"
    );
    expect(sql).not.toContain("sender_domain");
    expect(sql).not.toContain("raw_text");
    expect(sql).not.toContain("raw_body");
    expect(sql).not.toContain("merchant_name");
    expect(sql).not.toContain("amount_value");
  });

  it("rejects NULL Capture Improvement Sample enum fields in the retain RPC", () => {
    const sql = readFileSync(CAPTURE_IMPROVEMENT_SOURCE_PROVIDER_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("p_source_channel is null");
    expect(sql).toContain("p_source_family is null");
    expect(sql).toContain("p_provider_category is null");
    expect(sql).toContain("p_parse_outcome is null");
    expect(sql).toContain("p_confidence_bucket is null");
    expect(sql).toContain("p_extractor_method is null");
  });

  it("rejects inconsistent Capture Improvement Sample source metadata in the retain RPC", () => {
    const sql = readFileSync(CAPTURE_IMPROVEMENT_SOURCE_PROVIDER_MIGRATION, "utf8").toLowerCase();
    const compactSql = sql.replace(/\s+/g, " ");

    expect(compactSql).toContain("p_source_channel = 'email' and p_source_family <> 'email'");
    expect(compactSql).toContain(
      "p_source_channel = 'wallet' and (p_source_family <> 'wallet_notification' or p_provider_category <> 'wallet')"
    );
    expect(compactSql).toContain(
      "p_source_channel = 'notification' and (p_source_family <> 'android_notification' or p_provider_category = 'wallet')"
    );
  });

  it("rejects unsafe Capture Improvement Sample templates in the retain RPC", () => {
    const sql = readFileSync(CAPTURE_IMPROVEMENT_SOURCE_PROVIDER_MIGRATION, "utf8").toLowerCase();

    expect(sql).toMatch(/p_template_shape\s+~\*\s+'[^']*@[^']+'/u);
    expect(sql).toMatch(/p_template_shape\s+~\*\s+'[^']*ref[^']+'/u);
    expect(sql).toContain("p_template_shape ~ '\\y[0-9]+\\y'");
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
