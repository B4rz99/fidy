// biome-ignore-all lint/style/useNamingConvention: PostgreSQL roles and payloads use snake_case fields
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622090000_cloud_ledger_bootstrap.sql"
);
const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const POSTGRES_BINARIES = {
  initdb: findCommand("initdb"),
  pg_ctl: findCommand("pg_ctl"),
  psql: findCommand("psql"),
};
const missingPostgresBinaries = Object.entries(POSTGRES_BINARIES)
  .filter(([, path]) => path === null)
  .map(([command]) => command);
const postgresIt = missingPostgresBinaries.length === 0 ? it : it.skip;

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

  postgresIt(
    "blocks client roles from ledger tables and service-only bootstrap while service role reads scoped rows",
    () => {
      const postgres = setupSeededPostgres();

      expectClientRolesCannotReadLedger(postgres);
      expectClientRolesCannotExecuteBootstrap(postgres);
      expectBlankLedgerIdentifiersRejected(postgres);
      expectServiceRoleReadsOnlyScopedBootstrap(postgres);
    }
  );
});

function setupSeededPostgres(): PostgresHarness {
  const postgres = startPostgres();
  setupSupabaseAuthSurface(postgres);
  applyMigration(postgres);
  seedLedgerRows(postgres);
  return postgres;
}

function expectClientRolesCannotReadLedger(postgres: PostgresHarness) {
  const authenticatedError = psqlFails(
    postgres,
    "set role authenticated; select count(*) from ledger.transactions;"
  );
  const anonError = psqlFails(postgres, "set role anon; select count(*) from ledger.transactions;");

  expect(authenticatedError).toMatch(/permission denied/);
  expect(anonError).toMatch(/permission denied/);
}

function expectClientRolesCannotExecuteBootstrap(postgres: PostgresHarness) {
  const authenticatedError = psqlFails(
    postgres,
    `set role authenticated; select public.cloud_ledger_bootstrap('${OTHER_USER_ID}'::uuid, null::bigint);`
  );
  const anonError = psqlFails(
    postgres,
    `set role anon; select public.cloud_ledger_bootstrap('${OTHER_USER_ID}'::uuid, null::bigint);`
  );

  expect(authenticatedError).toMatch(/permission denied/);
  expect(anonError).toMatch(/permission denied/);
}

function expectBlankLedgerIdentifiersRejected(postgres: PostgresHarness) {
  const blankCategoryIdError = psqlFails(
    postgres,
    `insert into ledger.categories (user_id, id, name) values ('${USER_ID}'::uuid, ' ', 'Blank');`
  );
  const blankAccountIdError = psqlFails(
    postgres,
    `insert into ledger.financial_accounts (user_id, id, name, type) values ('${USER_ID}'::uuid, ' ', 'Blank', 'cash');`
  );
  const blankTransactionIdError = psqlFails(
    postgres,
    `insert into ledger.transactions (user_id, id, type, amount, account_id, date) values ('${USER_ID}'::uuid, ' ', 'expense', 1, 'acct-cash', '2026-06-01');`
  );
  const blankTransactionAccountIdError = psqlFails(
    postgres,
    `insert into ledger.transactions (user_id, id, type, amount, account_id, date) values ('${USER_ID}'::uuid, 'txn-blank-account', 'expense', 1, ' ', '2026-06-01');`
  );

  [
    blankCategoryIdError,
    blankAccountIdError,
    blankTransactionIdError,
    blankTransactionAccountIdError,
  ].forEach((error) => {
    expect(error).toMatch(/violates check constraint/);
  });
}

function expectServiceRoleReadsOnlyScopedBootstrap(postgres: PostgresHarness) {
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
}

function startPostgres(): PostgresHarness {
  const rootDir = mkdtempSync(join(tmpdir(), "fidy-cloud-ledger-pg-"));
  const dataDir = join(rootDir, "data");
  const socketDir = join(rootDir, "socket");
  const port = String(54_320 + Math.floor(Math.random() * 1_000));
  mkdirSync(socketDir);

  execFileSync(postgresBinary("initdb"), ["-D", dataDir, "-A", "trust", "-U", "postgres"], {
    stdio: "ignore",
  });
  execFileSync(
    postgresBinary("pg_ctl"),
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
    execFileSync(postgresBinary("pg_ctl"), ["-D", harness.dataDir, "-m", "fast", "stop"], {
      stdio: "ignore",
    });
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
  execFileSync(postgresBinary("psql"), ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-f", MIGRATION], {
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
  execFileSync(postgresBinary("psql"), ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", sql], {
    env: harness.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function psqlFails(harness: PostgresHarness, sql: string): string {
  try {
    psqlScalar(harness, sql);
  } catch (error) {
    return psqlFailureOutput(error);
  }
  throw new Error("Expected psql command to fail");
}

function psqlFailureOutput(error: unknown): string {
  return `${String((error as { readonly stdout?: unknown }).stdout ?? "")}\n${String(
    (error as { readonly stderr?: unknown }).stderr ?? ""
  )}`;
}

function findCommand(command: string): string | null {
  return (
    (process.env.PATH ?? "")
      .split(delimiter)
      .map((directory) => join(directory, command))
      .find((candidate) => existsSync(candidate)) ?? null
  );
}

function postgresBinary(command: keyof typeof POSTGRES_BINARIES): string {
  const binary = POSTGRES_BINARIES[command];
  if (binary === null) {
    throw new Error(`Missing PostgreSQL binary: ${command}`);
  }
  return binary;
}

function psqlScalar(harness: PostgresHarness, sql: string): string {
  return execFileSync(
    postgresBinary("psql"),
    ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-c", sql],
    {
      encoding: "utf8",
      env: harness.env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  ).trim();
}
