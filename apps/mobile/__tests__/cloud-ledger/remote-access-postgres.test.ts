// biome-ignore-all lint/style/useNamingConvention: PostgreSQL roles and payloads use snake_case fields
import { execFile, execFileSync } from "node:child_process";
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
const MIGRATIONS = [
  BOOTSTRAP_MIGRATION,
  CREATE_TRANSACTION_MIGRATION,
  PENDING_CHANGE_SET_MIGRATION,
  TRANSACTION_EDIT_DELETE_MIGRATION,
  OBSERVABILITY_SECURITY_MIGRATION,
] as const;
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
    overrides: {
      transactionId: "txn-zero-new-references",
      amount: 0,
      accountId: "acct-zero-side-effect",
      categoryId: "cat-zero-side-effect",
    },
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
    "lets the narrow Cloud Ledger API role execute boundary RPCs without direct ledger access",
    () => {
      const postgres = setupSeededPostgres();

      expectLedgerApiRoleCannotReadLedger(postgres);
      expectLedgerApiRoleReadsOnlyScopedBootstrap(postgres);
      expectAuthenticatorCanAssumeLedgerApiRole(postgres);
      expectClientRolesCannotAssumeLedgerApiRole(postgres);
      expectLedgerApiRoleRejectsCrossUserTransactionIdentity(postgres);
      expectLedgerApiRoleCannotExecuteInternalLedgerHelpers(postgres);
      expectFutureLedgerHelpersNotExecutableByLedgerApi(postgres);
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

  postgresIt("upgrades existing Cloud Ledger RPCs to return transaction versions", () => {
    const postgres = setupSeededPostgres();
    installLegacyTransactionResponseRpcs(postgres);

    expect(
      createTransactionOutcome(postgres, {
        transactionId: "txn-upgraded-rpc-version",
      }).transaction
    ).not.toHaveProperty("version");

    applyMigrationFile(postgres, TRANSACTION_EDIT_DELETE_MIGRATION);

    expect(
      createTransactionOutcome(postgres, {
        transactionId: "txn-upgraded-rpc-version",
      }).transaction
    ).toMatchObject({
      id: "txn-upgraded-rpc-version",
      version: 1,
    });
    expect(readRefreshAfterSequence(postgres, 4)).toMatchObject({
      transactions: [
        {
          id: "txn-upgraded-rpc-version",
          version: 1,
        },
      ],
    });
  });

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

  postgresIt("idempotently seeds shared local-only references for concurrent creates", async () => {
    const postgres = setupSeededPostgres();
    const lockedCursor = psqlScalarAsync(
      postgres,
      `
begin;
select 1
from ledger.ledger_cursors
where user_id = '${USER_ID}'::uuid
for update;
select pg_sleep(1);
commit;
`
    );
    await delay(100);

    const outcomes = await Promise.all([
      createTransactionOutcomeAsync(postgres, {
        transactionId: "txn-concurrent-local-refs-1",
        accountId: "acct-concurrent-local",
        categoryId: "cat-concurrent-local",
      }),
      createTransactionOutcomeAsync(postgres, {
        transactionId: "txn-concurrent-local-refs-2",
        accountId: "acct-concurrent-local",
        categoryId: "cat-concurrent-local",
      }),
    ]);
    await lockedCursor;

    expect(outcomes.map((outcome) => outcome.code)).toEqual(["accepted", "accepted"]);
    expect(outcomes.map((outcome) => outcome.cursor).sort()).toEqual(["ledger:7", "ledger:8"]);
    expect(readAccountRowCount(postgres, USER_ID, "acct-concurrent-local")).toBe("1");
    expect(readCategoryRowCount(postgres, USER_ID, "cat-concurrent-local")).toBe("1");
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

  postgresIt("partially accepts independent pending changes with typed repair outcomes", () => {
    const postgres = setupSeededPostgres();

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-invalid-category",
        transactionId: "txn-invalid-category",
        categoryId: "cat-deleted",
      }),
      pendingCreateChangeJson({
        changeId: "change-valid-market",
        transactionId: "txn-valid-market",
        categoryId: "cat-groceries",
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: ["change-valid-market"],
      rejectedChangeIds: ["change-invalid-category"],
      changeOutcomes: [
        {
          changeId: "change-invalid-category",
          status: "repair_required",
          code: "invalid_ledger_reference",
        },
        {
          changeId: "change-valid-market",
          status: "accepted",
          code: "accepted",
        },
      ],
      cursor: "ledger:5",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-invalid-category")).toBe("0");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-valid-market")).toBe("1");
  });

  postgresIt("partially accepts independent changes after parser-level repair outcomes", () => {
    const postgres = setupSeededPostgres();

    const outcome = applyPendingChangesOutcome(postgres, [
      invalidPendingChangeJson({
        changeId: "change-invalid-amount",
        invalidCode: "invalid_transaction",
      }),
      pendingCreateChangeJson({
        changeId: "change-valid-after-parser-repair",
        transactionId: "txn-valid-after-parser-repair",
        categoryId: "cat-groceries",
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: ["change-valid-after-parser-repair"],
      rejectedChangeIds: ["change-invalid-amount"],
      changeOutcomes: [
        {
          changeId: "change-invalid-amount",
          status: "repair_required",
          code: "invalid_transaction",
        },
        {
          changeId: "change-valid-after-parser-repair",
          status: "accepted",
          code: "accepted",
        },
      ],
      cursor: "ledger:5",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-valid-after-parser-repair")).toBe("1");
  });

  postgresIt("blocks dependent pending changes when a required prior change fails", () => {
    const postgres = setupSeededPostgres();

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-invalid-category",
        transactionId: "txn-invalid-category",
        categoryId: "cat-deleted",
      }),
      pendingCreateChangeJson({
        changeId: "change-dependent-valid",
        transactionId: "txn-dependent-valid",
        categoryId: "cat-groceries",
        dependencies: ["change-invalid-category"],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-invalid-category", "change-dependent-valid"],
      changeOutcomes: [
        {
          changeId: "change-invalid-category",
          status: "repair_required",
          code: "invalid_ledger_reference",
        },
        {
          changeId: "change-dependent-valid",
          status: "repair_required",
          code: "dependency_failed",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-dependent-valid")).toBe("0");
  });

  postgresIt("blocks pending changes whose dependencies have not been accepted yet", () => {
    const postgres = setupSeededPostgres();

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-out-of-order-dependent",
        transactionId: "txn-out-of-order-dependent",
        categoryId: "cat-groceries",
        dependencies: ["change-out-of-order-invalid"],
      }),
      pendingCreateChangeJson({
        changeId: "change-out-of-order-invalid",
        transactionId: "txn-out-of-order-invalid",
        categoryId: "cat-deleted",
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-out-of-order-dependent", "change-out-of-order-invalid"],
      changeOutcomes: [
        {
          changeId: "change-out-of-order-dependent",
          status: "repair_required",
          code: "dependency_failed",
        },
        {
          changeId: "change-out-of-order-invalid",
          status: "repair_required",
          code: "invalid_ledger_reference",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-out-of-order-dependent")).toBe("0");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-out-of-order-invalid")).toBe("0");
  });

  postgresIt("blocks pending changes whose dependencies are missing from the ledger", () => {
    const postgres = setupSeededPostgres();

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-missing-dependent",
        transactionId: "txn-missing-dependent",
        categoryId: "cat-groceries",
        dependencies: ["change-missing-prerequisite"],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-missing-dependent"],
      changeOutcomes: [
        {
          changeId: "change-missing-dependent",
          status: "repair_required",
          code: "dependency_failed",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-missing-dependent")).toBe("0");
  });

  postgresIt("retries accepted pending changes idempotently by change identity", () => {
    const postgres = setupSeededPostgres();

    expect(
      applyPendingChangesOutcome(postgres, [
        pendingCreateChangeJson({
          changeId: "change-idempotent-create",
          idempotencyKey: "idem-stable-create",
          transactionId: "txn-idempotent-original",
          categoryId: "cat-groceries",
        }),
      ])
    ).toMatchObject({
      acceptedChangeIds: ["change-idempotent-create"],
      rejectedChangeIds: [],
      cursor: "ledger:5",
    });

    expect(
      applyPendingChangesOutcome(postgres, [
        pendingCreateChangeJson({
          changeId: "change-idempotent-create",
          idempotencyKey: "idem-stable-create",
          transactionId: "txn-idempotent-original",
          categoryId: "cat-groceries",
        }),
      ])
    ).toMatchObject({
      acceptedChangeIds: ["change-idempotent-create"],
      rejectedChangeIds: [],
      changeOutcomes: [
        {
          changeId: "change-idempotent-create",
          status: "accepted",
          code: "accepted",
        },
      ],
      cursor: "ledger:5",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-idempotent-original")).toBe("1");
    expect(readMonthlyProjection(postgres)).toMatchObject({
      expenseAmount: 15000,
      transactionCount: 1,
      cursorSequence: 5,
    });
  });

  postgresIt("rejects idempotent retries that change the accepted target record", () => {
    const postgres = setupSeededPostgres();

    expect(
      applyPendingChangesOutcome(postgres, [
        pendingCreateChangeJson({
          changeId: "change-mutated-target",
          idempotencyKey: "idem-mutated-target",
          transactionId: "txn-mutated-target-original",
          categoryId: "cat-groceries",
        }),
      ])
    ).toMatchObject({
      acceptedChangeIds: ["change-mutated-target"],
      rejectedChangeIds: [],
      cursor: "ledger:5",
    });

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-mutated-target",
        idempotencyKey: "idem-mutated-target",
        transactionId: "txn-mutated-target-different",
        categoryId: "cat-groceries",
      }),
      pendingCreateChangeJson({
        changeId: "change-dependent-on-mutated-target",
        transactionId: "txn-dependent-on-mutated-target",
        categoryId: "cat-groceries",
        dependencies: ["change-mutated-target"],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-mutated-target", "change-dependent-on-mutated-target"],
      changeOutcomes: [
        {
          changeId: "change-mutated-target",
          status: "repair_required",
          code: "duplicate_idempotency_key",
        },
        {
          changeId: "change-dependent-on-mutated-target",
          status: "repair_required",
          code: "dependency_failed",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-mutated-target-original")).toBe("1");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-mutated-target-different")).toBe("0");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-dependent-on-mutated-target")).toBe("0");
  });

  postgresIt("rejects idempotent retries that change the accepted payload", () => {
    const postgres = setupSeededPostgres();

    expect(
      applyPendingChangesOutcome(postgres, [
        pendingCreateChangeJson({
          changeId: "change-mutated-payload",
          idempotencyKey: "idem-mutated-payload",
          transactionId: "txn-mutated-payload",
          categoryId: "cat-groceries",
          amount: 15000,
        }),
      ])
    ).toMatchObject({
      acceptedChangeIds: ["change-mutated-payload"],
      rejectedChangeIds: [],
      cursor: "ledger:5",
    });

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-mutated-payload",
        idempotencyKey: "idem-mutated-payload",
        transactionId: "txn-mutated-payload",
        categoryId: "cat-groceries",
        amount: 16000,
      }),
      pendingCreateChangeJson({
        changeId: "change-dependent-on-mutated-payload",
        transactionId: "txn-dependent-on-mutated-payload",
        categoryId: "cat-groceries",
        dependencies: ["change-mutated-payload"],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-mutated-payload", "change-dependent-on-mutated-payload"],
      changeOutcomes: [
        {
          changeId: "change-mutated-payload",
          status: "repair_required",
          code: "duplicate_idempotency_key",
        },
        {
          changeId: "change-dependent-on-mutated-payload",
          status: "repair_required",
          code: "dependency_failed",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-mutated-payload")).toBe("1");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-dependent-on-mutated-payload")).toBe(
      "0"
    );
    expect(readMonthlyProjection(postgres)).toMatchObject({
      expenseAmount: 15000,
      transactionCount: 1,
      cursorSequence: 5,
    });
  });

  postgresIt("blocks accepted replay when new dependencies failed earlier in the batch", () => {
    const postgres = setupSeededPostgres();

    expect(
      applyPendingChangesOutcome(postgres, [
        pendingCreateChangeJson({
          changeId: "change-b",
          idempotencyKey: "idem-change-b",
          transactionId: "txn-change-b",
          categoryId: "cat-groceries",
        }),
      ])
    ).toMatchObject({
      acceptedChangeIds: ["change-b"],
      rejectedChangeIds: [],
      cursor: "ledger:5",
    });

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-a",
        transactionId: "txn-change-a-invalid",
        categoryId: "cat-deleted",
      }),
      pendingCreateChangeJson({
        changeId: "change-b",
        idempotencyKey: "idem-change-b",
        transactionId: "txn-change-b",
        categoryId: "cat-groceries",
        dependencies: ["change-a"],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-a", "change-b"],
      changeOutcomes: [
        {
          changeId: "change-a",
          status: "repair_required",
          code: "invalid_ledger_reference",
        },
        {
          changeId: "change-b",
          status: "repair_required",
          code: "dependency_failed",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-change-b")).toBe("1");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-change-a-invalid")).toBe("0");
  });

  postgresIt("rejects reused idempotency keys for different changes and blocks dependents", () => {
    const postgres = setupSeededPostgres();

    expect(
      applyPendingChangesOutcome(postgres, [
        pendingCreateChangeJson({
          changeId: "change-original-idempotent",
          idempotencyKey: "idem-colliding-stable",
          transactionId: "txn-idem-original",
          categoryId: "cat-groceries",
        }),
      ])
    ).toMatchObject({
      acceptedChangeIds: ["change-original-idempotent"],
      rejectedChangeIds: [],
      cursor: "ledger:5",
    });

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-colliding-idempotency",
        idempotencyKey: "idem-colliding-stable",
        transactionId: "txn-idem-colliding",
        categoryId: "cat-groceries",
      }),
      pendingCreateChangeJson({
        changeId: "change-dependent-on-collision",
        transactionId: "txn-dependent-on-collision",
        categoryId: "cat-groceries",
        dependencies: ["change-colliding-idempotency"],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-colliding-idempotency", "change-dependent-on-collision"],
      changeOutcomes: [
        {
          changeId: "change-colliding-idempotency",
          status: "repair_required",
          code: "duplicate_idempotency_key",
        },
        {
          changeId: "change-dependent-on-collision",
          status: "repair_required",
          code: "dependency_failed",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-idem-original")).toBe("1");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-idem-colliding")).toBe("0");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-dependent-on-collision")).toBe("0");
  });

  postgresIt("rejects same-batch idempotency key reuse after a failed change", () => {
    const postgres = setupSeededPostgres();

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-duplicate-key-invalid",
        idempotencyKey: "idem-same-batch-reused",
        transactionId: "txn-duplicate-key-invalid",
        categoryId: "cat-deleted",
      }),
      pendingCreateChangeJson({
        changeId: "change-duplicate-key-valid",
        idempotencyKey: "idem-same-batch-reused",
        transactionId: "txn-duplicate-key-valid",
        categoryId: "cat-groceries",
      }),
      pendingCreateChangeJson({
        changeId: "change-dependent-on-duplicate-key",
        transactionId: "txn-dependent-on-duplicate-key",
        categoryId: "cat-groceries",
        dependencies: ["change-duplicate-key-valid"],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: [
        "change-duplicate-key-invalid",
        "change-duplicate-key-valid",
        "change-dependent-on-duplicate-key",
      ],
      changeOutcomes: [
        {
          changeId: "change-duplicate-key-invalid",
          status: "repair_required",
          code: "invalid_ledger_reference",
        },
        {
          changeId: "change-duplicate-key-valid",
          status: "repair_required",
          code: "duplicate_idempotency_key",
        },
        {
          changeId: "change-dependent-on-duplicate-key",
          status: "repair_required",
          code: "dependency_failed",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-duplicate-key-valid")).toBe("0");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-dependent-on-duplicate-key")).toBe("0");
  });

  postgresIt(
    "rejects duplicate change ids with different idempotency keys and blocks dependents",
    () => {
      const postgres = setupSeededPostgres();

      const outcome = applyPendingChangesOutcome(postgres, [
        pendingCreateChangeJson({
          changeId: "change-duplicate-id",
          idempotencyKey: "idem-duplicate-id-original",
          transactionId: "txn-duplicate-id-original",
          categoryId: "cat-groceries",
        }),
        pendingCreateChangeJson({
          changeId: "change-duplicate-id",
          idempotencyKey: "idem-duplicate-id-conflict",
          transactionId: "txn-duplicate-id-conflict",
          categoryId: "cat-groceries",
        }),
        pendingCreateChangeJson({
          changeId: "change-dependent-on-duplicate-id",
          transactionId: "txn-dependent-on-duplicate-id",
          categoryId: "cat-groceries",
          dependencies: ["change-duplicate-id"],
        }),
      ]);

      expect(outcome).toMatchObject({
        code: "accepted",
        acceptedChangeIds: ["change-duplicate-id"],
        rejectedChangeIds: ["change-duplicate-id", "change-dependent-on-duplicate-id"],
        changeOutcomes: [
          {
            changeId: "change-duplicate-id",
            status: "accepted",
            code: "accepted",
          },
          {
            changeId: "change-duplicate-id",
            status: "repair_required",
            code: "duplicate_change_id",
          },
          {
            changeId: "change-dependent-on-duplicate-id",
            status: "repair_required",
            code: "dependency_failed",
          },
        ],
        cursor: "ledger:5",
      });
      expect(readTransactionRowCount(postgres, USER_ID, "txn-duplicate-id-original")).toBe("1");
      expect(readTransactionRowCount(postgres, USER_ID, "txn-duplicate-id-conflict")).toBe("0");
      expect(readTransactionRowCount(postgres, USER_ID, "txn-dependent-on-duplicate-id")).toBe("0");
      expect(readAcceptedChangeRowCount(postgres, USER_ID, "change-duplicate-id")).toBe("1");
    }
  );

  postgresIt("rejects later change id reuse with a new idempotency key", () => {
    const postgres = setupSeededPostgres();

    expect(
      applyPendingChangesOutcome(postgres, [
        pendingCreateChangeJson({
          changeId: "change-durable-identity",
          idempotencyKey: "idem-durable-identity-original",
          transactionId: "txn-durable-identity-original",
          categoryId: "cat-groceries",
        }),
      ])
    ).toMatchObject({
      acceptedChangeIds: ["change-durable-identity"],
      rejectedChangeIds: [],
      cursor: "ledger:5",
    });

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-durable-identity",
        idempotencyKey: "idem-durable-identity-conflict",
        transactionId: "txn-durable-identity-conflict",
        categoryId: "cat-groceries",
      }),
      pendingCreateChangeJson({
        changeId: "change-dependent-on-durable-identity",
        transactionId: "txn-dependent-on-durable-identity",
        categoryId: "cat-groceries",
        dependencies: ["change-durable-identity"],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-durable-identity", "change-dependent-on-durable-identity"],
      changeOutcomes: [
        {
          changeId: "change-durable-identity",
          status: "repair_required",
          code: "duplicate_change_id",
        },
        {
          changeId: "change-dependent-on-durable-identity",
          status: "repair_required",
          code: "dependency_failed",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-durable-identity-original")).toBe("1");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-durable-identity-conflict")).toBe("0");
    expect(readTransactionRowCount(postgres, USER_ID, "txn-dependent-on-durable-identity")).toBe(
      "0"
    );
    expect(readAcceptedChangeRowCount(postgres, USER_ID, "change-durable-identity")).toBe("1");
  });

  postgresIt(
    "serializes concurrent accepted pending-change retries by idempotency key",
    async () => {
      const postgres = setupSeededPostgres();
      const lockedCursor = psqlScalarAsync(
        postgres,
        `
begin;
select 1
from ledger.ledger_cursors
where user_id = '${USER_ID}'::uuid
for update;
select pg_sleep(1);
commit;
`
      );
      await delay(100);

      const outcomes = await Promise.all([
        applyPendingChangesOutcomeAsync(postgres, [
          pendingCreateChangeJson({
            changeId: "change-concurrent-idempotent",
            idempotencyKey: "idem-concurrent-stable",
            transactionId: "txn-concurrent-idempotent-original",
            categoryId: "cat-groceries",
          }),
        ]),
        applyPendingChangesOutcomeAsync(postgres, [
          pendingCreateChangeJson({
            changeId: "change-concurrent-idempotent",
            idempotencyKey: "idem-concurrent-stable",
            transactionId: "txn-concurrent-idempotent-original",
            categoryId: "cat-groceries",
          }),
        ]),
      ]);
      await lockedCursor;

      expect(outcomes.map((outcome) => outcome.acceptedChangeIds)).toEqual([
        ["change-concurrent-idempotent"],
        ["change-concurrent-idempotent"],
      ]);
      expect(readTransactionRowCount(postgres, USER_ID, "txn-concurrent-idempotent-original")).toBe(
        "1"
      );
      expect(readMonthlyProjection(postgres)).toMatchObject({
        expenseAmount: 15000,
        transactionCount: 1,
        cursorSequence: 5,
      });
    }
  );

  postgresIt("serializes concurrent colliding idempotency keys and repairs the loser", async () => {
    const postgres = setupSeededPostgres();

    const outcomes = await Promise.all([
      applyPendingChangesOutcomeAsync(postgres, [
        pendingCreateChangeJson({
          changeId: "change-concurrent-collision-a",
          idempotencyKey: "idem-concurrent-collision",
          transactionId: "txn-concurrent-collision-a",
          categoryId: "cat-groceries",
        }),
      ]),
      applyPendingChangesOutcomeAsync(postgres, [
        pendingCreateChangeJson({
          changeId: "change-concurrent-collision-b",
          idempotencyKey: "idem-concurrent-collision",
          transactionId: "txn-concurrent-collision-b",
          categoryId: "cat-groceries",
        }),
      ]),
    ]);
    const acceptedChangeIds = outcomes.flatMap((outcome) => outcome.acceptedChangeIds);
    const rejectedOutcomes = outcomes.flatMap((outcome) =>
      outcome.changeOutcomes.filter(
        (changeOutcome: { readonly status: string }) => changeOutcome.status !== "accepted"
      )
    );

    expect(acceptedChangeIds).toHaveLength(1);
    expect(rejectedOutcomes).toEqual([
      expect.objectContaining({
        status: "repair_required",
        code: "duplicate_idempotency_key",
      }),
    ]);
    expect(
      Number(readTransactionRowCount(postgres, USER_ID, "txn-concurrent-collision-a")) +
        Number(readTransactionRowCount(postgres, USER_ID, "txn-concurrent-collision-b"))
    ).toBe(1);
    expect(readMonthlyProjection(postgres)).toMatchObject({
      expenseAmount: 15000,
      transactionCount: 1,
      cursorSequence: 5,
    });
  });

  postgresIt("rejects stale expected versions before applying a pending change", () => {
    const postgres = setupSeededPostgres();

    const outcome = applyPendingChangesOutcome(postgres, [
      pendingCreateChangeJson({
        changeId: "change-stale-guard",
        transactionId: "txn-stale-guard",
        categoryId: "cat-groceries",
        expectedVersions: [
          {
            recordType: "transaction",
            recordId: "txn-user",
            version: 2,
          },
        ],
      }),
    ]);

    expect(outcome).toMatchObject({
      code: "accepted",
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-stale-guard"],
      changeOutcomes: [
        {
          changeId: "change-stale-guard",
          status: "repair_required",
          code: "stale_expected_version",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readTransactionRowCount(postgres, USER_ID, "txn-stale-guard")).toBe("0");
  });

  postgresIt(
    "classifies unsupported pending change command versions as requiring app update",
    () => {
      const postgres = setupSeededPostgres();

      const outcome = applyPendingChangesOutcome(postgres, [
        {
          ...pendingCreateChangeJson({
            changeId: "change-old-command",
            transactionId: "txn-old-command",
            categoryId: "cat-groceries",
          }),
          commandVersion: 0,
        },
        pendingCreateChangeJson({
          changeId: "change-new-command",
          transactionId: "txn-new-command",
          categoryId: "cat-groceries",
        }),
      ]);

      expect(outcome).toMatchObject({
        code: "accepted",
        acceptedChangeIds: ["change-new-command"],
        rejectedChangeIds: ["change-old-command"],
        changeOutcomes: [
          {
            changeId: "change-old-command",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
          {
            changeId: "change-new-command",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:5",
      });
      expect(readTransactionRowCount(postgres, USER_ID, "txn-old-command")).toBe("0");
      expect(readTransactionRowCount(postgres, USER_ID, "txn-new-command")).toBe("1");
    }
  );

  postgresIt(
    "accepts transaction amend changes and refreshes the accepted Cloud Ledger view",
    () => {
      const postgres = setupSeededPostgres();

      expectAcceptedCreateOutcome(createTransactionOutcome(postgres));

      const outcome = applyPendingChangesOutcome(postgres, [
        pendingAmendChangeJson({
          changeId: "change-amend-market",
          transactionId: CLIENT_TRANSACTION_ID,
          amount: 19000,
          description: "Market corrected",
          expectedVersion: 1,
        }),
      ]);

      expect(outcome).toMatchObject({
        code: "accepted",
        acceptedChangeIds: ["change-amend-market"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-amend-market",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:6",
      });
      expect(readRefreshAfterSequence(postgres, 5)).toMatchObject({
        cursor: "ledger:6",
        transactions: [
          {
            id: CLIENT_TRANSACTION_ID,
            amount: 19000,
            description: "Market corrected",
          },
        ],
        tombstones: [],
      });
      expect(readMonthlyProjection(postgres)).toMatchObject({
        expenseAmount: 19000,
        transactionCount: 1,
        cursorSequence: 6,
      });
    }
  );

  postgresIt("seeds local-only ledger references before accepting transaction amends", () => {
    const postgres = setupSeededPostgres();

    expectAcceptedCreateOutcome(createTransactionOutcome(postgres));

    expect(
      applyPendingChangesOutcome(postgres, [
        pendingAmendChangeJson({
          accountId: "acct-amend-local-only",
          amount: 19000,
          categoryId: "cat-amend-local-only",
          changeId: "change-amend-local-only-refs",
          description: "Market corrected",
          expectedVersion: 1,
          transactionId: CLIENT_TRANSACTION_ID,
        }),
      ])
    ).toMatchObject({
      code: "accepted",
      acceptedChangeIds: ["change-amend-local-only-refs"],
      rejectedChangeIds: [],
      cursor: "ledger:8",
    });

    expect(readLedgerCursorSequence(postgres)).toBe("8");
    expect(readRefreshAfterSequence(postgres, 5)).toMatchObject({
      cursor: "ledger:8",
      categories: [
        {
          id: "cat-amend-local-only",
          name: "cat-amend-local-only",
        },
      ],
      financialAccounts: [
        {
          id: "acct-amend-local-only",
          name: "acct-amend-local-only",
          type: "cash",
          currency: "COP",
        },
      ],
      transactions: [
        {
          id: CLIENT_TRANSACTION_ID,
          accountId: "acct-amend-local-only",
          categoryId: "cat-amend-local-only",
        },
      ],
    });
  });

  postgresIt(
    "accepts transaction delete changes as tombstones and replays them idempotently",
    () => {
      const postgres = setupSeededPostgres();

      expectAcceptedCreateOutcome(createTransactionOutcome(postgres));

      const deleteChange = pendingDeleteChangeJson({
        changeId: "change-delete-market",
        transactionId: CLIENT_TRANSACTION_ID,
        expectedVersion: 1,
      });
      const outcome = applyPendingChangesOutcome(postgres, [deleteChange]);

      expect(outcome).toMatchObject({
        code: "accepted",
        acceptedChangeIds: ["change-delete-market"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-delete-market",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:6",
      });
      expect(readRefreshAfterSequence(postgres, 5)).toMatchObject({
        cursor: "ledger:6",
        transactions: [],
        tombstones: [
          {
            recordType: "transaction",
            recordId: CLIENT_TRANSACTION_ID,
          },
        ],
      });
      expect(readMonthlyProjection(postgres)).toMatchObject({
        expenseAmount: 0,
        transactionCount: 0,
        cursorSequence: 6,
      });

      expect(applyPendingChangesOutcome(postgres, [deleteChange])).toMatchObject({
        code: "accepted",
        acceptedChangeIds: ["change-delete-market"],
        rejectedChangeIds: [],
        cursor: "ledger:6",
      });
      expect(readLedgerCursorSequence(postgres)).toBe("6");
      expect(readTombstoneRowCount(postgres, USER_ID, CLIENT_TRANSACTION_ID)).toBe("1");
    }
  );

  postgresIt("rejects stale amend and delete changes as Ledger Conflicts", () => {
    const postgres = setupSeededPostgres();

    expectAcceptedCreateOutcome(createTransactionOutcome(postgres));
    expect(
      applyPendingChangesOutcome(postgres, [
        pendingAmendChangeJson({
          changeId: "change-first-amend-market",
          transactionId: CLIENT_TRANSACTION_ID,
          amount: 19000,
          description: "Market corrected",
          expectedVersion: 1,
        }),
      ])
    ).toMatchObject({
      acceptedChangeIds: ["change-first-amend-market"],
      rejectedChangeIds: [],
      cursor: "ledger:6",
    });

    const staleAmend = applyPendingChangesOutcome(postgres, [
      pendingAmendChangeJson({
        changeId: "change-stale-amend-market",
        transactionId: CLIENT_TRANSACTION_ID,
        amount: 21000,
        description: "Market stale amend",
        expectedVersion: 1,
      }),
    ]);
    const staleDelete = applyPendingChangesOutcome(postgres, [
      pendingDeleteChangeJson({
        changeId: "change-stale-delete-market",
        transactionId: CLIENT_TRANSACTION_ID,
        expectedVersion: 1,
      }),
    ]);

    expect(staleAmend).toMatchObject({
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-stale-amend-market"],
      changeOutcomes: [
        {
          changeId: "change-stale-amend-market",
          status: "repair_required",
          code: "stale_expected_version",
        },
      ],
      cursor: "ledger:0",
    });
    expect(staleDelete).toMatchObject({
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-stale-delete-market"],
      changeOutcomes: [
        {
          changeId: "change-stale-delete-market",
          status: "repair_required",
          code: "stale_expected_version",
        },
      ],
      cursor: "ledger:0",
    });
    expect(readRefreshAfterSequence(postgres, 5)).toMatchObject({
      cursor: "ledger:6",
      transactions: [
        {
          id: CLIENT_TRANSACTION_ID,
          amount: 19000,
          description: "Market corrected",
        },
      ],
      tombstones: [],
    });
    expect(readLedgerCursorSequence(postgres)).toBe("6");
  });

  postgresIt(
    "serializes two-device concurrent edit/delete and rejects the stale loser",
    async () => {
      const postgres = setupSeededPostgres();

      expectAcceptedCreateOutcome(createTransactionOutcome(postgres));

      const outcomes = await Promise.all([
        applyPendingChangesOutcomeAsyncWithEnvelope(postgres, {
          batchId: "batch-device-a-amend",
          changes: [
            pendingAmendChangeJson({
              changeId: "change-device-a-amend",
              transactionId: CLIENT_TRANSACTION_ID,
              amount: 19000,
              description: "Device A amend",
              expectedVersion: 1,
            }),
          ],
          deviceId: "device-a",
        }),
        applyPendingChangesOutcomeAsyncWithEnvelope(postgres, {
          batchId: "batch-device-b-delete",
          changes: [
            pendingDeleteChangeJson({
              changeId: "change-device-b-delete",
              transactionId: CLIENT_TRANSACTION_ID,
              expectedVersion: 1,
            }),
          ],
          deviceId: "device-b",
        }),
      ]);

      expect(outcomes.flatMap((outcome) => outcome.acceptedChangeIds)).toHaveLength(1);
      expect(
        outcomes.flatMap((outcome) =>
          outcome.changeOutcomes.filter(
            (changeOutcome: { readonly code: string }) =>
              changeOutcome.code === "stale_expected_version"
          )
        )
      ).toHaveLength(1);
      expect(readLedgerCursorSequence(postgres)).toBe("6");
      expect(
        Number(readAcceptedChangeRowCount(postgres, USER_ID, "change-device-a-amend")) +
          Number(readAcceptedChangeRowCount(postgres, USER_ID, "change-device-b-delete"))
      ).toBe(1);
    }
  );

  postgresIt(
    "records minimal Ledger Edit History for accepted amend and delete transitions",
    () => {
      const postgres = setupSeededPostgres();

      expectAcceptedCreateOutcome(createTransactionOutcome(postgres));
      expect(readTransactionEditHistoryRows(postgres)).toEqual([]);

      expect(
        applyPendingChangesOutcome(postgres, [
          pendingAmendChangeJson({
            changeId: "change-history-amend",
            transactionId: CLIENT_TRANSACTION_ID,
            amount: 19000,
            description: "Market corrected",
            expectedVersion: 1,
          }),
        ])
      ).toMatchObject({
        acceptedChangeIds: ["change-history-amend"],
        cursor: "ledger:6",
      });
      const deleteChange = pendingDeleteChangeJson({
        changeId: "change-history-delete",
        transactionId: CLIENT_TRANSACTION_ID,
        expectedVersion: 2,
      });
      expect(applyPendingChangesOutcome(postgres, [deleteChange])).toMatchObject({
        acceptedChangeIds: ["change-history-delete"],
        cursor: "ledger:7",
      });
      expect(applyPendingChangesOutcome(postgres, [deleteChange])).toMatchObject({
        acceptedChangeIds: ["change-history-delete"],
        cursor: "ledger:7",
      });

      expect(readTransactionEditHistoryRows(postgres)).toEqual([
        {
          action: "amend",
          newPayload: expect.objectContaining({
            amount: 19000,
            description: "Market corrected",
          }),
          newRecordVersion: 2,
          previousPayload: expect.objectContaining({
            amount: 15000,
            description: "Market",
          }),
          previousRecordVersion: 1,
          transactionId: CLIENT_TRANSACTION_ID,
        },
        {
          action: "delete",
          newPayload: null,
          newRecordVersion: 3,
          previousPayload: expect.objectContaining({
            amount: 19000,
            description: "Market corrected",
          }),
          previousRecordVersion: 2,
          transactionId: CLIENT_TRANSACTION_ID,
        },
      ]);
    }
  );

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
      version: 1,
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
    'txn-zero-new-references',
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
  expect(readAccountRowCount(postgres, USER_ID, "acct-zero-side-effect")).toBe("0");
  expect(readCategoryRowCount(postgres, USER_ID, "cat-zero-side-effect")).toBe("0");
}

function readCreatedTransactionRowCount(postgres: PostgresHarness) {
  return readTransactionRowCount(postgres, USER_ID, CLIENT_TRANSACTION_ID);
}

function readTransactionRowCount(postgres: PostgresHarness, userId: string, transactionId: string) {
  return psqlScalar(
    postgres,
    `
select count(*)
from ledger.transactions
where user_id = '${userId}'::uuid
  and id = '${transactionId}';
`
  );
}

function readAcceptedChangeRowCount(postgres: PostgresHarness, userId: string, changeId: string) {
  return psqlScalar(
    postgres,
    `
select count(*)
from ledger.pending_change_acceptances
where user_id = '${userId}'::uuid
  and change_id = '${changeId}';
`
  );
}

function readTombstoneRowCount(postgres: PostgresHarness, userId: string, recordId: string) {
  return psqlScalar(
    postgres,
    `
select count(*)
from ledger.tombstones
where user_id = '${userId}'::uuid
  and record_type = 'transaction'
  and record_id = '${recordId}';
`
  );
}

function readTransactionEditHistoryRows(postgres: PostgresHarness) {
  return JSON.parse(
    psqlScalar(
      postgres,
      `
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'action', action,
      'transactionId', transaction_id,
      'previousRecordVersion', previous_record_version,
      'newRecordVersion', new_record_version,
      'previousPayload', previous_payload,
      'newPayload', new_payload
    )
    order by cursor_sequence
  ),
  '[]'::jsonb
)::text
from ledger.transaction_edit_history
where user_id = '${USER_ID}'::uuid;
`
    )
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

function expectLedgerApiRoleCannotReadLedger(postgres: PostgresHarness) {
  const ledgerApiError = psqlFails(
    postgres,
    "set role ledger_api; select count(*) from ledger.transactions;"
  );

  expect(ledgerApiError).toMatch(/permission denied/);
}

function expectLedgerApiRoleReadsOnlyScopedBootstrap(postgres: PostgresHarness) {
  const payload = JSON.parse(
    psqlScalar(
      postgres,
      `set role ledger_api; select public.cloud_ledger_bootstrap('${USER_ID}'::uuid, 1::bigint)::text;`
    )
  );

  expect(payload).toMatchObject({
    cursor: "ledger:4",
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

function expectAuthenticatorCanAssumeLedgerApiRole(postgres: PostgresHarness) {
  const payload = JSON.parse(
    psqlScalar(
      postgres,
      `set session authorization authenticator; set role ledger_api; select public.cloud_ledger_bootstrap('${USER_ID}'::uuid, 1::bigint)::text;`
    )
  );

  expect(payload).toMatchObject({
    cursor: "ledger:4",
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

function expectClientRolesCannotAssumeLedgerApiRole(postgres: PostgresHarness) {
  const authenticatedError = psqlFails(
    postgres,
    "set session authorization authenticated; set role ledger_api; select current_role;"
  );
  const anonError = psqlFails(
    postgres,
    "set session authorization anon; set role ledger_api; select current_role;"
  );

  expect(authenticatedError).toMatch(/permission denied/);
  expect(anonError).toMatch(/permission denied/);
}

function expectLedgerApiRoleRejectsCrossUserTransactionIdentity(postgres: PostgresHarness) {
  const outcome = JSON.parse(
    psqlScalar(
      postgres,
      `
set role ledger_api;
select public.cloud_ledger_create_transaction(
  '${USER_ID}'::uuid,
  1,
  'txn-other',
  'expense',
  1,
  'COP',
  null,
  'acct-cash',
  'Denied',
  '2026-06-01'::date
)::text;
`
    )
  );

  expect(outcome).toEqual({ code: "unauthorized_transaction_id" });
  expect(readTransactionRowCount(postgres, USER_ID, "txn-other")).toBe("0");
  expect(readTransactionRowCount(postgres, OTHER_USER_ID, "txn-other")).toBe("1");
}

function expectLedgerApiRoleCannotExecuteInternalLedgerHelpers(postgres: PostgresHarness) {
  const internalHelperError = psqlFails(
    postgres,
    "set role ledger_api; select ledger.pending_change_outcome('change-a', 'accepted', 'accepted');"
  );

  expect(internalHelperError).toMatch(/permission denied/);
}

function expectFutureLedgerHelpersNotExecutableByLedgerApi(postgres: PostgresHarness) {
  psql(
    postgres,
    `
create function ledger.future_default_private_helper()
returns integer
language sql
as $$ select 1 $$;
`
  );

  expect(
    psqlScalar(
      postgres,
      "select has_function_privilege('ledger_api', 'ledger.future_default_private_helper()', 'execute');"
    )
  ).toBe("f");

  const futureHelperError = psqlFails(
    postgres,
    "set role ledger_api; select ledger.future_default_private_helper();"
  );

  expect(futureHelperError).toMatch(/permission denied/);
}

function readRefreshAfterInitialSeed(postgres: PostgresHarness) {
  return readRefreshAfterSequence(postgres, 4);
}

function readRefreshAfterSequence(postgres: PostgresHarness, sequence: number) {
  return JSON.parse(
    psqlScalar(
      postgres,
      `set role service_role; select public.cloud_ledger_bootstrap('${USER_ID}'::uuid, ${sequence}::bigint)::text;`
    )
  );
}

const startPostgres = (): PostgresHarness => {
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
};

const stopPostgres = (harness: PostgresHarness): void => {
  try {
    execFileSync(postgresBinary("pg_ctl"), ["-D", harness.dataDir, "-m", "fast", "stop"], {
      stdio: "ignore",
    });
  } finally {
    rmSync(harness.rootDir, { force: true, recursive: true });
  }
};

function setupSupabaseAuthSurface(harness: PostgresHarness) {
  psql(
    harness,
    `
create role anon;
create role authenticated;
create role authenticator;
create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
`
  );
}

function applyMigration(harness: PostgresHarness) {
  MIGRATIONS.forEach((migration) => {
    applyMigrationFile(harness, migration);
  });
}

function applyMigrationFile(harness: PostgresHarness, migration: string) {
  execFileSync(postgresBinary("psql"), ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-f", migration], {
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

function installLegacyTransactionResponseRpcs(harness: PostgresHarness) {
  psql(
    harness,
    `
create or replace function public.cloud_ledger_bootstrap(
  p_user_id uuid,
  p_after_sequence bigint default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
with cursor_state as (
  select coalesce(
    (
      select ledger.ledger_cursors.latest_sequence
      from ledger.ledger_cursors
      where ledger.ledger_cursors.user_id = p_user_id
    ),
    0
  ) as latest_sequence
),
transaction_rows as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ledger.transactions.id,
        'type', ledger.transactions.type,
        'amount', ledger.transactions.amount,
        'currency', ledger.transactions.currency,
        'categoryId', ledger.transactions.category_id,
        'accountId', ledger.transactions.account_id,
        'description', ledger.transactions.description,
        'date', ledger.transactions.date::text,
        'updatedAt', to_char(
          ledger.transactions.updated_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
      order by ledger.transactions.cursor_sequence, ledger.transactions.id
    ),
    '[]'::jsonb
  ) as rows
  from ledger.transactions
  where ledger.transactions.user_id = p_user_id
    and ledger.transactions.deleted_at is null
    and (
      p_after_sequence is null
      or ledger.transactions.cursor_sequence > p_after_sequence
    )
)
select jsonb_build_object(
  'cursor', 'ledger:' || cursor_state.latest_sequence::text,
  'categories', '[]'::jsonb,
  'financialAccounts', '[]'::jsonb,
  'transactions', transaction_rows.rows,
  'tombstones', '[]'::jsonb
)
from cursor_state, transaction_rows;
$$;

create or replace function public.cloud_ledger_create_transaction(
  p_user_id uuid,
  p_command_version integer,
  p_transaction_id text,
  p_type text,
  p_amount integer,
  p_currency text,
  p_category_id text,
  p_account_id text,
  p_description text,
  p_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_sequence bigint;
  v_existing_transaction ledger.transactions%rowtype;
  v_next_sequence bigint;
  v_updated_at timestamptz := now();
begin
  select ledger.transactions.*
  into v_existing_transaction
  from ledger.transactions
  where ledger.transactions.user_id = p_user_id
    and ledger.transactions.id = p_transaction_id;

  if found then
    select coalesce(
      (
        select ledger.ledger_cursors.latest_sequence
        from ledger.ledger_cursors
        where ledger.ledger_cursors.user_id = p_user_id
      ),
      v_existing_transaction.cursor_sequence
    )
    into v_current_sequence;

    return jsonb_build_object(
      'code', 'accepted',
      'transaction', jsonb_build_object(
        'id', v_existing_transaction.id,
        'type', v_existing_transaction.type,
        'amount', v_existing_transaction.amount,
        'currency', v_existing_transaction.currency,
        'categoryId', v_existing_transaction.category_id,
        'accountId', v_existing_transaction.account_id,
        'description', v_existing_transaction.description,
        'date', v_existing_transaction.date::text,
        'updatedAt', to_char(
          v_existing_transaction.updated_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      ),
      'cursor', 'ledger:' || v_current_sequence::text
    );
  end if;

  select ledger.ledger_cursors.latest_sequence + 1
  into v_next_sequence
  from ledger.ledger_cursors
  where ledger.ledger_cursors.user_id = p_user_id
  for update;

  insert into ledger.transactions (
    user_id,
    id,
    type,
    amount,
    currency,
    category_id,
    account_id,
    description,
    date,
    record_version,
    cursor_sequence,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_transaction_id,
    p_type,
    p_amount,
    p_currency,
    p_category_id,
    p_account_id,
    p_description,
    p_date,
    1,
    v_next_sequence,
    v_updated_at,
    v_updated_at
  );

  update ledger.ledger_cursors
  set latest_sequence = v_next_sequence,
      updated_at = v_updated_at
  where ledger.ledger_cursors.user_id = p_user_id;

  return jsonb_build_object(
    'code', 'accepted',
    'transaction', jsonb_build_object(
      'id', p_transaction_id,
      'type', p_type,
      'amount', p_amount,
      'currency', p_currency,
      'categoryId', p_category_id,
      'accountId', p_account_id,
      'description', p_description,
      'date', p_date::text,
      'updatedAt', to_char(
        v_updated_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    ),
    'cursor', 'ledger:' || v_next_sequence::text
  );
end;
$$;
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

async function createTransactionOutcomeAsync(
  harness: PostgresHarness,
  overrides: CreateTransactionOverrides = {}
) {
  return JSON.parse(
    await psqlScalarAsync(
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

function applyPendingChangesOutcome(harness: PostgresHarness, changes: readonly unknown[]) {
  return JSON.parse(
    psqlScalar(
      harness,
      `
set role service_role;
select public.cloud_ledger_apply_pending_changes(
  '${USER_ID}'::uuid,
  1,
  'device-ios-17-pro',
  'batch-20260601-offline',
  ${jsonbSql(changes)}
)::text;
`
    )
  );
}

async function applyPendingChangesOutcomeAsync(
  harness: PostgresHarness,
  changes: readonly unknown[]
) {
  return applyPendingChangesOutcomeAsyncWithEnvelope(harness, {
    batchId: "batch-20260601-offline",
    changes,
    deviceId: "device-ios-17-pro",
  });
}

async function applyPendingChangesOutcomeAsyncWithEnvelope(
  harness: PostgresHarness,
  input: {
    readonly batchId: string;
    readonly changes: readonly unknown[];
    readonly deviceId: string;
  }
) {
  return JSON.parse(
    await psqlScalarAsync(
      harness,
      `
set role service_role;
select public.cloud_ledger_apply_pending_changes(
  '${USER_ID}'::uuid,
  1,
  '${input.deviceId}',
  '${input.batchId}',
  ${jsonbSql(input.changes)}
)::text;
`
    )
  );
}

function pendingCreateChangeJson(input: {
  readonly changeId: string;
  readonly idempotencyKey?: string;
  readonly transactionId: string;
  readonly amount?: number;
  readonly categoryId: string | null;
  readonly dependencies?: readonly string[];
  readonly expectedVersions?: readonly unknown[];
}) {
  return {
    id: input.changeId,
    kind: "createTransaction",
    commandVersion: 1,
    idempotencyKey: input.idempotencyKey ?? `idem-${input.changeId}`,
    dependencies: input.dependencies ?? [],
    expectedVersions: input.expectedVersions ?? [],
    clientTimestamp: "2026-06-01T10:02:00.000Z",
    transaction: {
      id: input.transactionId,
      type: "expense",
      amount: input.amount ?? 15000,
      currency: "COP",
      categoryId: input.categoryId,
      accountId: "acct-cash",
      description: "Market",
      date: "2026-06-01",
    },
  };
}

function pendingAmendChangeJson(input: {
  readonly accountId?: string;
  readonly changeId: string;
  readonly categoryId?: string | null;
  readonly transactionId: string;
  readonly amount: number;
  readonly description: string;
  readonly expectedVersion: number;
}) {
  return {
    id: input.changeId,
    kind: "amendTransaction",
    commandVersion: 1,
    idempotencyKey: `idem-${input.changeId}`,
    dependencies: [],
    expectedVersions: [
      {
        recordType: "transaction",
        recordId: input.transactionId,
        version: input.expectedVersion,
      },
    ],
    clientTimestamp: "2026-06-01T10:05:00.000Z",
    transaction: {
      id: input.transactionId,
      type: "expense",
      amount: input.amount,
      currency: "COP",
      categoryId: input.categoryId ?? "cat-groceries",
      accountId: input.accountId ?? "acct-cash",
      description: input.description,
      date: "2026-06-01",
    },
  };
}

function pendingDeleteChangeJson(input: {
  readonly changeId: string;
  readonly transactionId: string;
  readonly expectedVersion: number;
}) {
  return {
    id: input.changeId,
    kind: "deleteTransaction",
    commandVersion: 1,
    idempotencyKey: `idem-${input.changeId}`,
    dependencies: [],
    expectedVersions: [
      {
        recordType: "transaction",
        recordId: input.transactionId,
        version: input.expectedVersion,
      },
    ],
    clientTimestamp: "2026-06-01T10:06:00.000Z",
    transactionId: input.transactionId,
  };
}

function invalidPendingChangeJson(input: {
  readonly changeId: string;
  readonly invalidCode:
    | "invalid_ledger_reference"
    | "invalid_transaction"
    | "invalid_transaction_id";
}) {
  return {
    id: input.changeId,
    kind: "invalidPendingChange",
    commandVersion: 1,
    idempotencyKey: `idem-${input.changeId}`,
    dependencies: [],
    expectedVersions: [],
    clientTimestamp: "2026-06-01T10:02:00.000Z",
    invalidCode: input.invalidCode,
  };
}

function jsonbSql(value: unknown) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
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

function psqlScalarAsync(harness: PostgresHarness, sql: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      postgresBinary("psql"),
      ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-c", sql],
      { encoding: "utf8", env: harness.env },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }));
          return;
        }
        resolvePromise(stdout.trim());
      }
    );
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
