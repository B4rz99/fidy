// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  exportLocalLedgerBackupSnapshot,
  importLocalLedgerBackupSnapshot,
} from "@/features/backup/public";
import {
  accountSuggestionDismissals,
  budgets,
  captureEvidence,
  financialAccountIdentifiers,
  financialAccounts,
  goalContributions,
  goals,
  openingBalances,
  processedCaptures,
  processedEmails,
  syncConflicts,
  transactions,
  transfers,
  userCategories,
} from "@/shared/db/schema";

let sourceSqlite: InstanceType<typeof Database>;
let targetSqlite: InstanceType<typeof Database>;
let sourceDb: ReturnType<typeof drizzle>;
let targetDb: ReturnType<typeof drizzle>;

const NOW = "2026-04-23T10:30:00.000Z";

function migrateMemoryDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
  return { sqlite, db };
}

beforeEach(() => {
  const source = migrateMemoryDb();
  const target = migrateMemoryDb();
  sourceSqlite = source.sqlite;
  targetSqlite = target.sqlite;
  sourceDb = source.db;
  targetDb = target.db;
});

afterEach(() => {
  sourceSqlite.close();
  targetSqlite.close();
});

function seedLocalLedgerFixture() {
  seedAccounts();
  seedActivity();
  seedPlanningRows();
  seedCaptureAndReviewState();
}

function seedAccounts() {
  sourceSqlite.exec(`
    insert into user_categories (
      id, user_id, name, icon_name, color_hex, created_at, updated_at, deleted_at
    ) values ('uc-food', 'user-1', 'Work lunches', 'utensils', '#2F80ED', '${NOW}', '${NOW}', null);

    insert into financial_accounts (
      id, user_id, name, kind, is_default, statement_closing_day, payment_due_day,
      created_at, updated_at, deleted_at
    ) values ('fa-bank', 'user-1', 'Bancolombia', 'checking', 1, null, null, '${NOW}', '${NOW}', null);

    insert into financial_account_identifiers (
      id, user_id, account_id, scope, value, created_at, updated_at, deleted_at
    ) values ('fai-1', 'user-1', 'fa-bank', 'last4', '1234', '${NOW}', '${NOW}', null);

    insert into opening_balances (
      id, user_id, account_id, amount, effective_date, created_at, updated_at, deleted_at
    ) values ('ob-1', 'user-1', 'fa-bank', 250000, '2026-04-01', '${NOW}', '${NOW}', null);
  `);
}

function seedActivity() {
  sourceSqlite.exec(`
    insert into transactions (
      id, user_id, type, amount, category_id, description, date, account_id,
      account_attribution_state, superseded_at, created_at, updated_at, deleted_at, source
    ) values (
      'txn-1', 'user-1', 'expense', 42000, 'uc-food', 'Lunch', '2026-04-20', 'fa-bank',
      'confirmed', null, '${NOW}', '${NOW}', null, 'email'
    );

    insert into transfers (
      id, user_id, amount, from_account_id, to_account_id, from_external_label, to_external_label,
      description, date, created_at, updated_at, deleted_at
    ) values (
      'trf-1', 'user-1', 100000, 'fa-bank', null, null, 'Broker',
      'Investment', '2026-04-21', '${NOW}', '${NOW}', null
    );
  `);
}

function seedPlanningRows() {
  sourceSqlite.exec(`
    insert into budgets (
      id, user_id, category_id, amount, month, created_at, updated_at, deleted_at
    ) values ('budget-1', 'user-1', 'uc-food', 500000, '2026-04', '${NOW}', '${NOW}', null);

    insert into goals (
      id, user_id, name, type, target_amount, target_date, interest_rate_percent,
      icon_name, color_hex, created_at, updated_at, deleted_at
    ) values (
      'goal-1', 'user-1', 'Emergency fund', 'savings', 5000000, '2026-12-31', null,
      'piggy-bank', '#2F80ED', '${NOW}', '${NOW}', null
    );

    insert into goal_contributions (
      id, goal_id, user_id, amount, note, date, created_at, updated_at, deleted_at
    ) values ('gc-1', 'goal-1', 'user-1', 100000, 'April', '2026-04-22', '${NOW}', '${NOW}', null);
  `);
}

function seedCaptureAndReviewState() {
  seedProcessedCaptures();
  seedCaptureEvidence();
  seedDismissalsAndConflicts();
}

function seedProcessedCaptures() {
  sourceSqlite.exec(`
    insert into processed_emails (
      id, external_id, provider, status, failure_reason, subject, raw_body_preview,
      received_at, transaction_id, confidence, created_at, raw_body, retry_count, next_retry_at
    ) values (
      'email-1', 'provider-message-1', 'gmail', 'needs_review', 'ambiguous_account',
      'Purchase alert', 'Paid with card ending 1234', '${NOW}', 'txn-1', 0.62,
      '${NOW}', 'Paid with card ending 1234 at Store', 1, null
    );

    insert into processed_captures (
      id, fingerprint_hash, source, status, raw_text, transaction_id, confidence, received_at, created_at
    ) values ('capture-1', 'hash-1', 'notification', 'success', 'Transfer sent', null, 0.91, '${NOW}', '${NOW}');
  `);
}

function seedCaptureEvidence() {
  sourceSqlite.exec(`
    insert into capture_evidence (
      id, user_id, source_family, evidence_type, scope, value, transaction_id, transfer_id,
      processed_email_id, processed_capture_id, created_at, updated_at, deleted_at
    ) values
      ('ce-email', 'user-1', 'gmail', 'last4', 'last4', '1234', 'txn-1', null, 'email-1', null, '${NOW}', '${NOW}', null),
      ('ce-capture', 'user-1', 'push', 'alias_token', 'alias', 'Broker', null, 'trf-1', null, 'capture-1', '${NOW}', '${NOW}', null);
  `);
}

function seedDismissalsAndConflicts() {
  sourceSqlite.exec(`
    insert into account_suggestion_dismissals (
      id, user_id, scope, value, dismissed_score, created_at, updated_at, deleted_at
    ) values ('dismissal-1', 'user-1', 'last4', '9999', 70, '${NOW}', '${NOW}', null);

    insert into sync_conflicts (
      id, transaction_id, local_data, server_data, detected_at, resolved_at, resolution
    ) values ('conflict-1', 'txn-1', '{"amount":42000}', '{"amount":43000}', '${NOW}', null, null);
  `);
}

function expectRestoredLedgerToMatchSource() {
  expectRestoredAccountsAndActivity();
  expectRestoredPlanningRows();
  expectRestoredCaptureAndReviewState();
}

function expectRestoredAccountsAndActivity() {
  expect(targetDb.select().from(userCategories).all()).toEqual(
    sourceDb.select().from(userCategories).all()
  );
  expect(targetDb.select().from(financialAccounts).all()).toEqual(
    sourceDb.select().from(financialAccounts).all()
  );
  expect(targetDb.select().from(financialAccountIdentifiers).all()).toEqual(
    sourceDb.select().from(financialAccountIdentifiers).all()
  );
  expect(targetDb.select().from(openingBalances).all()).toEqual(
    sourceDb.select().from(openingBalances).all()
  );
  expect(targetDb.select().from(transactions).all()).toEqual(
    sourceDb.select().from(transactions).all()
  );
  expect(targetDb.select().from(transfers).all()).toEqual(sourceDb.select().from(transfers).all());
}

function expectRestoredPlanningRows() {
  expect(targetDb.select().from(budgets).all()).toEqual(sourceDb.select().from(budgets).all());
  expect(targetDb.select().from(goals).all()).toEqual(sourceDb.select().from(goals).all());
  expect(targetDb.select().from(goalContributions).all()).toEqual(
    sourceDb.select().from(goalContributions).all()
  );
}

function expectRestoredCaptureAndReviewState() {
  expect(targetDb.select().from(processedEmails).all()).toEqual(
    sourceDb.select().from(processedEmails).all()
  );
  expect(targetDb.select().from(processedCaptures).all()).toEqual(
    sourceDb.select().from(processedCaptures).all()
  );
  expect(targetDb.select().from(captureEvidence).all()).toEqual(
    sourceDb.select().from(captureEvidence).all()
  );
  expect(targetDb.select().from(accountSuggestionDismissals).all()).toEqual(
    sourceDb.select().from(accountSuggestionDismissals).all()
  );
  expect(targetDb.select().from(syncConflicts).all()).toEqual(
    sourceDb.select().from(syncConflicts).all()
  );
}

function snapshotWithDuplicateIdentifierRows() {
  return {
    version: 1,
    exportedAt: NOW,
    data: emptySnapshotData({
      financialAccounts: [rollbackAccountRow()],
      financialAccountIdentifiers: duplicateIdentifierRows(),
    }),
  };
}

function snapshotWithLargeAccountTable() {
  return {
    version: 1,
    exportedAt: NOW,
    data: emptySnapshotData({
      financialAccounts: Array.from({ length: 51 }, (_, index) =>
        rollbackAccountRow(`fa-${index}`)
      ),
    }),
  };
}

function emptySnapshotData(overrides: Record<string, unknown> = {}) {
  return {
    transactions: [],
    transfers: [],
    userCategories: [],
    financialAccounts: [],
    openingBalances: [],
    budgets: [],
    goals: [],
    goalContributions: [],
    captureEvidence: [],
    financialAccountIdentifiers: [],
    accountSuggestionDismissals: [],
    processedEmails: [],
    processedCaptures: [],
    syncConflicts: [],
    ...overrides,
  };
}

function rollbackAccountRow(id = "fa-rollback") {
  return {
    id,
    userId: "user-1",
    name: "Rollback wallet",
    kind: "wallet",
    isDefault: true,
    statementClosingDay: null,
    paymentDueDay: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function duplicateIdentifierRows() {
  return [rollbackIdentifierRow("1234"), rollbackIdentifierRow("5678")];
}

function rollbackIdentifierRow(value: string) {
  return {
    id: "fai-duplicate",
    userId: "user-1",
    accountId: "fa-rollback",
    scope: "last4",
    value,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function createCappedInsertDb(maxRowsPerInsert: number) {
  let insertedRows = 0;
  const tx = {
    insert: () => ({
      values: (rows: Record<string, unknown>[]) => {
        if (rows.length > maxRowsPerInsert) {
          throw new Error("too many SQL variables");
        }
        return { run: () => (insertedRows += rows.length) };
      },
    }),
  };
  return {
    db: { transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx) },
    getInsertedRows: () => insertedRows,
  };
}

describe("local ledger backup snapshots", () => {
  it("round-trips financial accounts into a clean local database", () => {
    sourceSqlite.exec(`
      insert into financial_accounts (
        id, user_id, name, kind, is_default, statement_closing_day, payment_due_day,
        created_at, updated_at, deleted_at
      ) values (
        'fa-main', 'user-1', 'Main wallet', 'wallet', 1, null, null,
        '${NOW}', '${NOW}', null
      );
    `);

    const snapshot = exportLocalLedgerBackupSnapshot(sourceDb as any, { exportedAt: NOW });
    importLocalLedgerBackupSnapshot(targetDb as any, snapshot);

    expect(targetDb.select().from(financialAccounts).all()).toEqual([
      expect.objectContaining({
        id: "fa-main",
        userId: "user-1",
        name: "Main wallet",
        kind: "wallet",
        isDefault: true,
      }),
    ]);
  });

  it("round-trips the local ledger tables needed for backup restore", () => {
    seedLocalLedgerFixture();

    const snapshot = exportLocalLedgerBackupSnapshot(sourceDb as any, { exportedAt: NOW });
    importLocalLedgerBackupSnapshot(targetDb as any, snapshot);

    expect(snapshot).toMatchObject({
      version: 1,
      exportedAt: NOW,
      data: {
        transactions: expect.any(Array),
        transfers: expect.any(Array),
        userCategories: expect.any(Array),
        financialAccounts: expect.any(Array),
        openingBalances: expect.any(Array),
        budgets: expect.any(Array),
        goals: expect.any(Array),
        goalContributions: expect.any(Array),
        captureEvidence: expect.any(Array),
        financialAccountIdentifiers: expect.any(Array),
        accountSuggestionDismissals: expect.any(Array),
        processedEmails: expect.any(Array),
        processedCaptures: expect.any(Array),
        syncConflicts: expect.any(Array),
      },
    });
    expectRestoredLedgerToMatchSource();
  });

  it("rejects unsupported snapshot versions", () => {
    expect(() =>
      importLocalLedgerBackupSnapshot(
        targetDb as any,
        {
          version: 999,
          exportedAt: NOW,
          data: {},
        } as any
      )
    ).toThrow("Unsupported local ledger backup snapshot version: 999");
  });

  it("rejects malformed version 1 snapshots", () => {
    expect(() =>
      importLocalLedgerBackupSnapshot(
        targetDb as any,
        {
          version: 1,
          exportedAt: NOW,
          data: {
            financialAccounts: [],
          },
        } as any
      )
    ).toThrow("Malformed local ledger backup snapshot");
  });

  it("rejects non-record rows before import", () => {
    expect(() =>
      importLocalLedgerBackupSnapshot(targetDb as any, {
        version: 1,
        exportedAt: NOW,
        data: emptySnapshotData({ financialAccounts: [null] }),
      })
    ).toThrow("Malformed local ledger backup snapshot");
  });

  it("rolls back a failed snapshot import", () => {
    expect(() =>
      importLocalLedgerBackupSnapshot(targetDb as any, snapshotWithDuplicateIdentifierRows())
    ).toThrow();

    expect(targetDb.select().from(financialAccounts).all()).toEqual([]);
  });

  it("imports table rows in bounded chunks", () => {
    const { db, getInsertedRows } = createCappedInsertDb(50);

    importLocalLedgerBackupSnapshot(db as any, snapshotWithLargeAccountTable());

    expect(getInsertedRows()).toBe(51);
  });
});
