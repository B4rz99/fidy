import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260425100000_encrypted_backups.sql"
);
const WRITE_BOUNDARY_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260427100000_private_backup_api_write_boundary.sql"
);
const MOBILE_BACKUP_SOURCE_ROOT = resolve(__dirname, "../../features/backup");
const MIGRATIONS_ROOT = resolve(__dirname, "../../supabase/migrations");
const WRITE_BOUNDARY_MIGRATION_NAME = basename(WRITE_BOUNDARY_MIGRATION);

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

  it("removes direct authenticated writes so private-backup-api owns backup mutations", () => {
    const sql = readFileSync(WRITE_BOUNDARY_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain('drop policy if exists "users can read own encrypted backups"');
    expect(sql).toContain('drop policy if exists "users can insert own encrypted backups"');
    expect(sql).toContain('drop policy if exists "users can update own encrypted backups"');
    expect(sql).toContain('drop policy if exists "users can delete own encrypted backups"');
    expect(sql).toContain('drop policy if exists "users can read own encrypted backup objects"');
    expect(sql).toContain('drop policy if exists "users can insert own encrypted backup objects"');
    expect(sql).toContain('drop policy if exists "users can update own encrypted backup objects"');
    expect(sql).toContain('drop policy if exists "users can delete own encrypted backup objects"');
    expect(sql).not.toContain("create policy");
  });

  it("keeps encrypted backups locked down after direct policies are removed", () => {
    const sql = readFileSync(WRITE_BOUNDARY_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain("alter table public.encrypted_backups enable row level security");
    expect(sql).toContain("alter table public.encrypted_backups force row level security");
    expect(sql).toContain("update storage.buckets");
    expect(sql).toContain("set public = false");
    expect(sql).toContain("where id = 'encrypted-backups'");
  });

  it("keeps later migrations from restoring direct authenticated backup access", () => {
    const laterMigrationSql = readdirSync(MIGRATIONS_ROOT)
      .filter((fileName) => fileName >= WRITE_BOUNDARY_MIGRATION_NAME && fileName.endsWith(".sql"))
      .map((fileName) => readFileSync(resolve(MIGRATIONS_ROOT, fileName), "utf8").toLowerCase())
      .join("\n");

    expect(laterMigrationSql).not.toMatch(
      /create\s+policy[\s\S]*\bon\s+public\.encrypted_backups[\s\S]*\bto\s+authenticated/u
    );
    expect(hasDirectAuthenticatedBackupObjectPolicy(laterMigrationSql)).toBe(false);
  });
});

describe("mobile backup source boundary", () => {
  it("keeps normal backup operations behind private-backup-api instead of direct table or bucket access", () => {
    const backupSource = readSourceTree(MOBILE_BACKUP_SOURCE_ROOT);

    expect(backupSource).not.toMatch(
      /\.from\(\s*(["']encrypted_backups["']|remote_backup_metadata_table)\s*\)/u
    );
    expect(backupSource).not.toMatch(
      /\.storage\s*\.from\(\s*(["']encrypted-backups["']|remote_backup_bucket)\s*\)/u
    );
    expect(backupSource).toContain('functions.invoke<t>("private-backup-api"');
  });
});

function readSourceTree(root: string): string {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(root, entry.name);
      if (entry.isDirectory()) {
        return readSourceTree(path);
      }
      if (!entry.isFile() || !/\.(ts|tsx)$/u.test(entry.name)) {
        return [];
      }
      return readFileSync(path, "utf8");
    })
    .join("\n")
    .toLowerCase();
}

function hasDirectAuthenticatedBackupObjectPolicy(sql: string) {
  return policyStatements(sql).some(
    (statement) =>
      statement.includes("on storage.objects") &&
      statement.includes("to authenticated") &&
      statement.includes("encrypted-backups")
  );
}

function policyStatements(sql: string) {
  return sql.match(/create\s+policy[\s\S]*?;/gu) ?? [];
}
