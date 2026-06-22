import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622090000_cloud_ledger_bootstrap.sql"
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
});
