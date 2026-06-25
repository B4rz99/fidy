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
type CreateTransactionOverrides = Partial<{
  readonly commandVersion: number | null;
  readonly transactionId: string;
  readonly type: "income" | "expense" | null;
  readonly amount: number | null;
  readonly currency: "COP" | null;
  readonly categoryId: string | null;
  readonly accountId: string | null;
  readonly description: string | null;
  readonly date: string | null;
}>;
type RejectedCreateCase = {
  readonly overrides: CreateTransactionOverrides;
  readonly outcome: { readonly code: string };
};

const harnesses: PostgresHarness[] = [];
const INVALID_CREATE_CASES: readonly RejectedCreateCase[] = [
  {
    overrides: { transactionId: "txn-other" },
    outcome: { code: "unauthorized_transaction_id" },
  },
  {
    overrides: { transactionId: "txn-deleted-account", accountId: "acct-deleted" },
    outcome: { code: "invalid_ledger_reference" },
  },
  {
    overrides: { transactionId: "txn-deleted-category", categoryId: "cat-deleted" },
    outcome: { code: "invalid_ledger_reference" },
  },
  {
    overrides: {
      transactionId: "txn-new-account-deleted-category",
      accountId: "acct-side-effect",
      categoryId: "cat-deleted",
    },
    outcome: { code: "invalid_ledger_reference" },
  },
  {
    overrides: { transactionId: "txn-zero", amount: 0 },
    outcome: { code: "invalid_transaction" },
  },
  {
    overrides: { transactionId: "txn-future", date: "2999-01-01" },
    outcome: { code: "invalid_transaction" },
  },
  {
    overrides: { commandVersion: null, transactionId: "txn-null-version" },
    outcome: { code: "unsupported_command_version" },
  },
  {
    overrides: { transactionId: "txn-null-type", type: null },
    outcome: { code: "invalid_transaction" },
  },
  {
    overrides: { transactionId: "txn-null-amount", amount: null },
    outcome: { code: "invalid_transaction" },
  },
  {
    overrides: { transactionId: "txn-null-currency", currency: null },
    outcome: { code: "invalid_transaction" },
  },
  {
    overrides: { transactionId: "txn-null-date", date: null },
    outcome: { code: "invalid_transaction" },
  },
];

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

      expectAcceptedCreateOutcome(createTransactionOutcome(postgres));
      expectRefreshContainsCreatedTransaction(postgres);
      expectRebuiltMonthlyProjection(postgres);
    }
  );

  postgresIt("accepts repeated matching transaction creates without advancing the cursor", () => {
    const postgres = setupSeededPostgres();

    expectAcceptedCreateOutcome(createTransactionOutcome(postgres));
    expectAcceptedCreateOutcome(createTransactionOutcome(postgres));

    expect(readLedgerCursorSequence(postgres)).toBe("5");
    expect(readCreatedTransactionRowCount(postgres)).toBe("1");
  });

  postgresIt("seeds local-only ledger references before accepting transaction creates", () => {
    const postgres = setupSeededPostgres();

    expect(
      createTransactionOutcome(postgres, {
        transactionId: "txn-local-only-refs",
        accountId: "acct-local-only",
        categoryId: "cat-local-only",
      })
    ).toMatchObject({
      code: "accepted",
      transaction: {
        id: "txn-local-only-refs",
        accountId: "acct-local-only",
        categoryId: "cat-local-only",
      },
      cursor: "ledger:7",
    });

    expect(readLedgerCursorSequence(postgres)).toBe("7");
    expect(readRefreshAfterInitialSeed(postgres)).toMatchObject({
      cursor: "ledger:7",
      categories: [
        {
          id: "cat-local-only",
          name: "cat-local-only",
        },
      ],
      financialAccounts: [
        {
          id: "acct-local-only",
          name: "acct-local-only",
          type: "cash",
          currency: "COP",
        },
      ],
      transactions: [
        {
          id: "txn-local-only-refs",
          accountId: "acct-local-only",
          categoryId: "cat-local-only",
        },
      ],
    });
  });

  postgresIt("seeds built-in categories per user even when another user has the same id", () => {
    const postgres = setupSeededPostgres();
    psql(
      postgres,
      `
insert into ledger.categories (
  user_id, id, name, icon, color, cursor_sequence, updated_at, deleted_at
) values (
  '${OTHER_USER_ID}'::uuid, 'cat-shared-built-in', 'Shared built-in', null, null, 10, '2026-06-01T10:00:00Z', null
);
`
    );

    expect(
      createTransactionOutcome(postgres, {
        transactionId: "txn-shared-built-in-category",
        categoryId: "cat-shared-built-in",
      })
    ).toMatchObject({
      code: "accepted",
      transaction: {
        id: "txn-shared-built-in-category",
        categoryId: "cat-shared-built-in",
      },
      cursor: "ledger:6",
    });
    expect(readCategoryRowCount(postgres, USER_ID, "cat-shared-built-in")).toBe("1");
    expect(readCategoryRowCount(postgres, OTHER_USER_ID, "cat-shared-built-in")).toBe("1");
  });

  postgresIt("seeds local-only accounts per user even when another user has the same id", () => {
    const postgres = setupSeededPostgres();

    expect(
      createTransactionOutcome(postgres, {
        transactionId: "txn-shared-account-id",
        accountId: "acct-other",
      })
    ).toMatchObject({
      code: "accepted",
      transaction: {
        id: "txn-shared-account-id",
        accountId: "acct-other",
      },
      cursor: "ledger:6",
    });
    expect(readAccountRowCount(postgres, USER_ID, "acct-other")).toBe("1");
    expect(readAccountRowCount(postgres, OTHER_USER_ID, "acct-other")).toBe("1");
  });

  postgresIt("rebuilds monthly projections for valid totals above integer range", () => {
    const postgres = setupSeededPostgres();

    expect(
      createTransactionOutcome(postgres, {
        transactionId: "txn-high-monthly-total-1",
        amount: 1_500_000_000,
      })
    ).toMatchObject({ code: "accepted", cursor: "ledger:5" });
    expect(
      createTransactionOutcome(postgres, {
        transactionId: "txn-high-monthly-total-2",
        amount: 1_500_000_000,
      })
    ).toMatchObject({ code: "accepted", cursor: "ledger:6" });

    expect(readMonthlyProjection(postgres)).toEqual({
      month: "2026-06",
      incomeAmount: 0,
      expenseAmount: 3_000_000_000,
      transactionCount: 2,
      cursorSequence: 6,
    });
  });

  postgresIt(
    "rejects invalid transaction creates without partial cursor or projection writes",
    () => {
      const postgres = setupSeededPostgres();

      INVALID_CREATE_CASES.forEach((testCase) => {
        expectRejectedCreateOutcome(postgres, testCase);
      });
      expectRejectedCreatesHaveNoSideEffects(postgres);
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

function expectAcceptedCreateOutcome(outcome: unknown) {
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
}

function expectRefreshContainsCreatedTransaction(postgres: PostgresHarness) {
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
}

function expectRebuiltMonthlyProjection(postgres: PostgresHarness) {
  expect(readMonthlyProjection(postgres)).toEqual({
    month: "2026-06",
    incomeAmount: 0,
    expenseAmount: 15000,
    transactionCount: 1,
    cursorSequence: 5,
  });
}

function expectRejectedCreateOutcome(postgres: PostgresHarness, testCase: RejectedCreateCase) {
  expect(createTransactionOutcome(postgres, testCase.overrides)).toEqual(testCase.outcome);
}

function expectRejectedCreatesHaveNoSideEffects(postgres: PostgresHarness) {
  expect(readLedgerCursorSequence(postgres)).toBe("4");
  expect(
    psqlScalar(
      postgres,
      `
select count(*)
from ledger.transactions
	where user_id = '${USER_ID}'::uuid
	  and id in (
	    'txn-deleted-account',
	    'txn-deleted-category',
	    'txn-new-account-deleted-category',
	    'txn-zero',
    'txn-future',
    'txn-null-version',
    'txn-null-type',
    'txn-null-amount',
    'txn-null-currency',
    'txn-null-date'
  );
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
  expect(readAccountRowCount(postgres, USER_ID, "acct-side-effect")).toBe("0");
}

function readCreatedTransactionRowCount(postgres: PostgresHarness) {
  return psqlScalar(
    postgres,
    `
select count(*)
from ledger.transactions
where user_id = '${USER_ID}'::uuid
  and id = '${CLIENT_TRANSACTION_ID}';
`
  );
}

function readCategoryRowCount(postgres: PostgresHarness, userId: string, categoryId: string) {
  return psqlScalar(
    postgres,
    `
select count(*)
from ledger.categories
where user_id = '${userId}'::uuid
  and id = '${categoryId}';
`
  );
}

function readAccountRowCount(postgres: PostgresHarness, userId: string, accountId: string) {
  return psqlScalar(
    postgres,
    `
select count(*)
from ledger.financial_accounts
where user_id = '${userId}'::uuid
  and id = '${accountId}';
`
  );
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

function readRefreshAfterInitialSeed(postgres: PostgresHarness) {
  return JSON.parse(
    psqlScalar(
      postgres,
      `set role service_role; select public.cloud_ledger_bootstrap('${USER_ID}'::uuid, 4::bigint)::text;`
    )
  );
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
  user_id, id, name, icon, color, cursor_sequence, updated_at, deleted_at
) values
  ('${USER_ID}'::uuid, 'cat-groceries', 'Groceries', 'basket', '#2F6F5E', 1, '2026-06-01T10:00:00Z', null),
  ('${USER_ID}'::uuid, 'cat-deleted', 'Deleted', null, null, 1, '2026-06-01T10:00:00Z', '2026-06-02T11:00:00Z'),
  ('${OTHER_USER_ID}'::uuid, 'cat-other', 'Other', null, null, 1, '2026-06-01T10:00:00Z', null);

insert into ledger.financial_accounts (
  user_id, id, name, type, currency, cursor_sequence, updated_at, deleted_at
) values
  ('${USER_ID}'::uuid, 'acct-cash', 'Cash', 'cash', 'COP', 2, '2026-06-01T10:01:00Z', null),
  ('${USER_ID}'::uuid, 'acct-deleted', 'Deleted', 'cash', 'COP', 2, '2026-06-01T10:01:00Z', '2026-06-02T11:00:00Z'),
  ('${OTHER_USER_ID}'::uuid, 'acct-other', 'Other', 'cash', 'COP', 2, '2026-06-01T10:01:00Z', null);

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
  overrides: CreateTransactionOverrides = {}
) {
  return JSON.parse(
    psqlScalar(
      harness,
      `
set role service_role;
select public.cloud_ledger_create_transaction(
  '${USER_ID}'::uuid,
  ${nullableSqlInteger(overrides.commandVersion === undefined ? 1 : overrides.commandVersion)},
  '${overrides.transactionId ?? CLIENT_TRANSACTION_ID}',
  ${nullableSqlText(overrides.type === undefined ? "expense" : overrides.type)},
  ${nullableSqlInteger(overrides.amount === undefined ? 15000 : overrides.amount)},
  ${nullableSqlText(overrides.currency === undefined ? "COP" : overrides.currency)},
  ${nullableSqlText(overrides.categoryId === undefined ? "cat-groceries" : overrides.categoryId)},
  ${nullableSqlText(overrides.accountId === undefined ? "acct-cash" : overrides.accountId)},
  ${nullableSqlText(overrides.description === undefined ? "Market" : overrides.description)},
  ${nullableSqlDate(overrides.date === undefined ? "2026-06-01" : overrides.date)}
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

function nullableSqlInteger(value: number | null) {
  return value === null ? "null::integer" : String(value);
}

function nullableSqlDate(value: string | null) {
  return value === null ? "null::date" : `'${value}'::date`;
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
