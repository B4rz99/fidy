// biome-ignore-all lint/style/useNamingConvention: PostgreSQL roles and payloads use snake_case fields
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const BOOTSTRAP_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622090000_cloud_ledger_bootstrap.sql"
);
const CREATE_TRANSACTION_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260622100000_cloud_ledger_transaction_create.sql"
);
const MIGRATIONS = [BOOTSTRAP_MIGRATION, CREATE_TRANSACTION_MIGRATION] as const;
const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const CLIENT_TRANSACTION_ID = "txn-20260622-client";
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
      expectClientRolesCannotExecuteCreate(postgres);
      expectBlankLedgerIdentifiersRejected(postgres);
      expectTransactionMoneyAndDateConstraints(postgres);
      expectServiceRoleReadsOnlyScopedBootstrap(postgres);
    }
  );

  postgresIt(
    "accepts online transaction creates through the service-only command and refresh cursor",
    () => {
      const postgres = setupSeededPostgres();
      seedStaleMonthlyProjection(postgres);

      const outcome = JSON.parse(
        psqlScalar(
          postgres,
          `
set role service_role;
select public.cloud_ledger_create_transaction(
  '${USER_ID}'::uuid,
  1,
  '${CLIENT_TRANSACTION_ID}',
  'expense',
  15000,
  'COP',
  'cat-groceries',
  'acct-cash',
  'Market',
  '2026-06-01'::date
)::text;
`
        )
      );

      expect(outcome).toEqual({
        code: "accepted",
        transaction: {
          id: CLIENT_TRANSACTION_ID,
          type: "expense",
          amount: 15000,
          currency: "COP",
          categoryId: "cat-groceries",
          accountId: "acct-cash",
          description: "Market",
          date: "2026-06-01",
          updatedAt: expect.stringMatching(/^2026-|\d{4}-/),
        },
        cursor: "ledger:5",
      });

      const refresh = JSON.parse(
        psqlScalar(
          postgres,
          `set role service_role; select public.cloud_ledger_bootstrap('${USER_ID}'::uuid, 4::bigint)::text;`
        )
      );

      expect(refresh).toMatchObject({
        cursor: "ledger:5",
        transactions: [
          {
            id: CLIENT_TRANSACTION_ID,
            amount: 15000,
            categoryId: "cat-groceries",
            accountId: "acct-cash",
          },
        ],
      });
      expect(readMonthlyProjection(postgres)).toEqual({
        month: "2026-06",
        incomeAmount: 0,
        expenseAmount: 15000,
        transactionCount: 1,
        cursorSequence: 5,
      });
    }
  );

  postgresIt(
    "rejects invalid transaction creates without partial cursor or projection writes",
    () => {
      const postgres = setupSeededPostgres();

      expect(createTransactionOutcome(postgres, { transactionId: "txn-other" })).toEqual({
        code: "unauthorized_transaction_id",
      });
      expect(
        createTransactionOutcome(postgres, {
          transactionId: "txn-bad-account",
          accountId: "acct-other",
        })
      ).toEqual({
        code: "invalid_ledger_reference",
      });
      expect(
        createTransactionOutcome(postgres, {
          transactionId: "txn-bad-category",
          categoryId: "cat-other",
        })
      ).toEqual({ code: "invalid_ledger_reference" });
      expect(createTransactionOutcome(postgres, { transactionId: "txn-zero", amount: 0 })).toEqual({
        code: "invalid_transaction",
      });
      expect(
        createTransactionOutcome(postgres, {
          transactionId: "txn-future",
          date: "2999-01-01",
        })
      ).toEqual({ code: "invalid_transaction" });

      expect(readLedgerCursorSequence(postgres)).toBe("4");
      expect(
        psqlScalar(
          postgres,
          `
select count(*)
from ledger.transactions
where user_id = '${USER_ID}'::uuid
  and id in ('txn-bad-account', 'txn-bad-category', 'txn-zero', 'txn-future');
`
        )
      ).toBe("0");
      expect(
        psqlScalar(
          postgres,
          `
select count(*)
from ledger.transaction_monthly_totals
where user_id = '${USER_ID}'::uuid;
`
        )
      ).toBe("0");
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

function expectClientRolesCannotExecuteCreate(postgres: PostgresHarness) {
  const sql = `
select public.cloud_ledger_create_transaction(
  '${OTHER_USER_ID}'::uuid,
  1,
  'txn-client-denied',
  'expense',
  1,
  'COP',
  null,
  'acct-other',
  'Denied',
  '2026-06-01'::date
);`;
  const authenticatedError = psqlFails(postgres, `set role authenticated; ${sql}`);
  const anonError = psqlFails(postgres, `set role anon; ${sql}`);

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

function expectTransactionMoneyAndDateConstraints(postgres: PostgresHarness) {
  const zeroAmountError = psqlFails(
    postgres,
    `insert into ledger.transactions (user_id, id, type, amount, account_id, date) values ('${USER_ID}'::uuid, 'txn-zero-constraint', 'expense', 0, 'acct-cash', '2026-06-01');`
  );
  const futureDateError = psqlFails(
    postgres,
    `insert into ledger.transactions (user_id, id, type, amount, account_id, date) values ('${USER_ID}'::uuid, 'txn-future-constraint', 'expense', 1, 'acct-cash', '2999-01-01');`
  );

  expect(zeroAmountError).toMatch(/violates check constraint/);
  expect(futureDateError).toMatch(/violates check constraint/);
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
  MIGRATIONS.forEach((migration) => {
    execFileSync(postgresBinary("psql"), ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-f", migration], {
      env: harness.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
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

insert into ledger.categories (
  user_id, id, name, icon, color, cursor_sequence, updated_at
) values
  ('${USER_ID}'::uuid, 'cat-groceries', 'Groceries', 'basket', '#2F6F5E', 1, '2026-06-01T10:00:00Z'),
  ('${OTHER_USER_ID}'::uuid, 'cat-other', 'Other', null, null, 1, '2026-06-01T10:00:00Z');

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

function seedStaleMonthlyProjection(harness: PostgresHarness) {
  psql(
    harness,
    `
insert into ledger.transaction_monthly_totals (
  user_id, month, income_amount, expense_amount, transaction_count, cursor_sequence
) values (
  '${USER_ID}'::uuid, '2026-06', 999999, 999999, 99, 4
);
`
  );
}

function readMonthlyProjection(harness: PostgresHarness) {
  return JSON.parse(
    psqlScalar(
      harness,
      `
select jsonb_build_object(
  'month', month,
  'incomeAmount', income_amount,
  'expenseAmount', expense_amount,
  'transactionCount', transaction_count,
  'cursorSequence', cursor_sequence
)::text
from ledger.transaction_monthly_totals
where user_id = '${USER_ID}'::uuid and month = '2026-06';
`
    )
  );
}

function createTransactionOutcome(
  harness: PostgresHarness,
  overrides: Partial<{
    readonly transactionId: string;
    readonly type: "income" | "expense";
    readonly amount: number;
    readonly currency: "COP";
    readonly categoryId: string | null;
    readonly accountId: string;
    readonly description: string | null;
    readonly date: string;
  }> = {}
) {
  return JSON.parse(
    psqlScalar(
      harness,
      `
set role service_role;
select public.cloud_ledger_create_transaction(
  '${USER_ID}'::uuid,
  1,
  '${overrides.transactionId ?? CLIENT_TRANSACTION_ID}',
  '${overrides.type ?? "expense"}',
  ${overrides.amount ?? 15000},
  '${overrides.currency ?? "COP"}',
  ${nullableSqlText(overrides.categoryId === undefined ? "cat-groceries" : overrides.categoryId)},
  '${overrides.accountId ?? "acct-cash"}',
  ${nullableSqlText(overrides.description === undefined ? "Market" : overrides.description)},
  '${overrides.date ?? "2026-06-01"}'::date
)::text;
`
    )
  );
}

function readLedgerCursorSequence(harness: PostgresHarness) {
  return psqlScalar(
    harness,
    `select latest_sequence from ledger.ledger_cursors where user_id = '${USER_ID}'::uuid;`
  );
}

function nullableSqlText(value: string | null) {
  return value === null ? "null" : `'${value}'`;
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
