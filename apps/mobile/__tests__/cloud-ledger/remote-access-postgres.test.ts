// biome-ignore-all lint/style/useNamingConvention: PostgreSQL roles and payloads use snake_case fields
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622090000_cloud_ledger_bootstrap.sql"
);
const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";

type PostgresHarness = {
  readonly dataDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly rootDir: string;
};

const harnesses: PostgresHarness[] = [];

describe("Cloud Ledger Postgres access boundary", () => {
  afterEach(() => {
    harnesses.splice(0).forEach(stopPostgres);
  });

  it("blocks client roles from ledger tables and service-only bootstrap while service role reads scoped rows", () => {
    const postgres = startPostgres();
    setupSupabaseAuthSurface(postgres);
    applyMigration(postgres);
    seedLedgerRows(postgres);

    expect(
      psqlFails(postgres, "set role authenticated; select count(*) from ledger.transactions;")
    ).toMatch(/permission denied/);
    expect(psqlFails(postgres, "set role anon; select count(*) from ledger.transactions;")).toMatch(
      /permission denied/
    );
    expect(
      psqlFails(
        postgres,
        `set role authenticated; select public.cloud_ledger_bootstrap('${OTHER_USER_ID}'::uuid, null::bigint);`
      )
    ).toMatch(/permission denied/);
    expect(
      psqlFails(
        postgres,
        `set role anon; select public.cloud_ledger_bootstrap('${OTHER_USER_ID}'::uuid, null::bigint);`
      )
    ).toMatch(/permission denied/);

    const payload = JSON.parse(
      psqlScalar(
        postgres,
        `set role service_role; select public.cloud_ledger_bootstrap('${USER_ID}'::uuid, 1::bigint)::text;`
      )
    );

    expect(payload).toMatchObject({
      cursor: "ledger:4",
      categories: [],
      financialAccounts: [
        {
          id: "acct-cash",
          name: "Cash",
          type: "cash",
          currency: "COP",
        },
      ],
      transactions: [],
      tombstones: [
        {
          recordType: "transaction",
          recordId: "txn-user",
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("txn-other");
    expect(JSON.stringify(payload)).not.toContain("acct-other");
  });
});

function startPostgres(): PostgresHarness {
  const rootDir = mkdtempSync(join(tmpdir(), "fidy-cloud-ledger-pg-"));
  const dataDir = join(rootDir, "data");
  const socketDir = join(rootDir, "socket");
  const port = String(54_320 + Math.floor(Math.random() * 1_000));
  mkdirSync(socketDir);

  execFileSync("initdb", ["-D", dataDir, "-A", "trust", "-U", "postgres"], {
    stdio: "ignore",
  });
  execFileSync(
    "pg_ctl",
    [
      "-D",
      dataDir,
      "-l",
      join(rootDir, "postgres.log"),
      "-o",
      `-k ${socketDir} -p ${port}`,
      "start",
    ],
    { stdio: "ignore" }
  );

  const harness = {
    dataDir,
    env: {
      ...process.env,
      PGDATABASE: "postgres",
      PGHOST: socketDir,
      PGPORT: port,
      PGUSER: "postgres",
    },
    rootDir,
  };
  harnesses.push(harness);
  return harness;
}

function stopPostgres(harness: PostgresHarness) {
  try {
    execFileSync("pg_ctl", ["-D", harness.dataDir, "-m", "fast", "stop"], { stdio: "ignore" });
  } finally {
    rmSync(harness.rootDir, { force: true, recursive: true });
  }
}

function setupSupabaseAuthSurface(harness: PostgresHarness) {
  psql(
    harness,
    `
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
`
  );
}

function applyMigration(harness: PostgresHarness) {
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-f", MIGRATION], {
    env: harness.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function seedLedgerRows(harness: PostgresHarness) {
  psql(
    harness,
    `
insert into auth.users (id) values
  ('${USER_ID}'::uuid),
  ('${OTHER_USER_ID}'::uuid);

insert into ledger.ledger_cursors (user_id, latest_sequence) values
  ('${USER_ID}'::uuid, 4),
  ('${OTHER_USER_ID}'::uuid, 9);

insert into ledger.financial_accounts (
  user_id, id, name, type, currency, cursor_sequence, updated_at
) values
  ('${USER_ID}'::uuid, 'acct-cash', 'Cash', 'cash', 'COP', 2, '2026-06-01T10:01:00Z'),
  ('${OTHER_USER_ID}'::uuid, 'acct-other', 'Other', 'cash', 'COP', 2, '2026-06-01T10:01:00Z');

insert into ledger.transactions (
  user_id, id, type, amount, currency, account_id, date, cursor_sequence, deleted_at, updated_at
) values
  ('${USER_ID}'::uuid, 'txn-user', 'expense', 15000, 'COP', 'acct-cash', '2026-06-01', 3, '2026-06-02T11:00:00Z', '2026-06-01T10:02:00Z'),
  ('${OTHER_USER_ID}'::uuid, 'txn-other', 'income', 99000, 'COP', 'acct-other', '2026-06-02', 3, null, '2026-06-02T10:02:00Z');

insert into ledger.tombstones (
  user_id, record_type, record_id, cursor_sequence, deleted_at
) values
  ('${USER_ID}'::uuid, 'transaction', 'txn-user', 4, '2026-06-02T11:00:00Z'),
  ('${OTHER_USER_ID}'::uuid, 'transaction', 'txn-other-hidden', 8, '2026-06-02T11:00:00Z');
`
  );
}

function psql(harness: PostgresHarness, sql: string) {
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", sql], {
    env: harness.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function psqlScalar(harness: PostgresHarness, sql: string): string {
  return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf8",
    env: harness.env,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function psqlFails(harness: PostgresHarness, sql: string): string {
  try {
    psqlScalar(harness, sql);
    throw new Error("Expected psql command to fail");
  } catch (error) {
    if (error instanceof Error && error.message === "Expected psql command to fail") {
      throw error;
    }
    return `${String((error as { readonly stdout?: unknown }).stdout ?? "")}\n${String(
      (error as { readonly stderr?: unknown }).stderr ?? ""
    )}`;
  }
}
