import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260425100000_encrypted_backups.sql"
);

describe("remote encrypted backup schema", () => {
  it("stores only encrypted backup metadata and scopes table and blob access to the owner", () => {
    const sql = readFileSync(MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("insert into storage.buckets");
    expect(sql).toContain("'encrypted-backups'");
    expect(sql).toContain("create table if not exists public.encrypted_backups");
    expect(sql).toContain("id text not null");
    expect(sql).toContain("user_id uuid not null references auth.users(id) on delete cascade");
    expect(sql).toContain("created_at timestamptz not null");
    expect(sql).toContain("schema_version integer not null");
    expect(sql).toContain("app_version text not null");
    expect(sql).toContain("device_label text not null");
    expect(sql).toContain("ciphertext_size_bytes integer not null");
    expect(sql).toContain("ciphertext_sha256 text not null");
    expect(sql).toContain("alter table public.encrypted_backups enable row level security");
    expect(sql).toContain("(select auth.uid()) = user_id");
    expect(sql).toContain("storage.foldername(name)");
    expect(sql).toContain("(storage.foldername(name))[1] = (select auth.uid())::text");
    expect(sql).not.toMatch(/plaintext|raw_key|derived_key|recovery_key|recovery_phrase/u);
  });
});
