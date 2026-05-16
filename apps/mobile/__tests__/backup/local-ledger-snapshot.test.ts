// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import { getTableName } from "drizzle-orm";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  exportLocalLedgerBackupSnapshot,
  importLocalLedgerBackupSnapshot,
  validateBackupSnapshot,
} from "@/infrastructure/local-ledger/snapshot";
import {
  accountSuggestionDismissals,
  budgets,
  captureEvidence,
  financialAccountIdentifiers,
  financialAccounts,
  goalContributions,
  goals,
  notifications,
  openingBalances,
  processedCaptures,
  processedEmails,
  processedSourceEvents,
  reviewCandidateCaptureEvidence,
  reviewCandidates,
  transactions,
  transfers,
  userMemories,
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
      account_attribution_state, superseded_at, superseded_by_transfer_id, created_at, updated_at,
      voided_at, source
    ) values
    (
      'txn-1', 'user-1', 'expense', 42000, 'uc-food', 'Lunch', '2026-04-20', 'fa-bank',
      'confirmed', null, null, '${NOW}', '${NOW}', null, 'email_capture'
    ),
    (
      'txn-voided', 'user-1', 'expense', 18000, 'uc-food', 'Voided lunch', '2026-04-18',
      'fa-bank', 'confirmed', null, null, '${NOW}', '${NOW}', '${NOW}', 'manual'
    );

    insert into transfers (
      id, user_id, amount, from_account_id, to_account_id, from_external_label, to_external_label,
      description, date, created_at, updated_at, deleted_at
    ) values
    (
      'trf-1', 'user-1', 100000, 'fa-bank', null, null, 'Broker',
      'Investment', '2026-04-21', '${NOW}', '${NOW}', null
    ),
    (
      'trf-deleted', 'user-1', 65000, null, 'fa-bank', 'Cash', null,
      'Restored inactive transfer', '2026-04-19', '${NOW}', '${NOW}', '${NOW}'
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

function seedExcludedRows() {
  sourceSqlite.exec(`
    insert into notifications (
      id, user_id, type, dedup_key, category_id, goal_id, title_key, message_key,
      params, created_at, updated_at, deleted_at
    ) values (
      'notif-1', 'user-1', 'budget_alert', 'budget-alert-1', 'uc-food', null,
      'notifications.budget.title', 'notifications.budget.message', '{"amount":42000}',
      '${NOW}', '${NOW}', null
    );

    insert into user_memories (
      id, user_id, fact, category, created_at, updated_at
    ) values (
      'memory-1', 'user-1', 'Usually buys lunch near work', 'preference', '${NOW}', '${NOW}'
    );
  `);
}

function seedStaleLocalLedgerRows() {
  targetSqlite.exec(`
    insert into user_categories (
      id, user_id, name, icon_name, color_hex, created_at, updated_at, deleted_at
    ) values ('uc-stale', 'user-1', 'Stale category', 'archive', '#111111', '${NOW}', '${NOW}', null);

    insert into financial_accounts (
      id, user_id, name, kind, is_default, statement_closing_day, payment_due_day,
      created_at, updated_at, deleted_at
    ) values ('fa-bank', 'user-1', 'Old Bancolombia', 'checking', 1, null, null, '${NOW}', '${NOW}', null);

    insert into processed_source_events (
      id, user_id, source_family, source_id, source_event_id, status, failure_reason,
      received_at, processed_at, created_at, updated_at, deleted_at
    ) values (
      'pse-stale', 'user-1', 'email', 'gmail-primary', 'gmail-stale',
      'needs_review', null, '${NOW}', '${NOW}', '${NOW}', '${NOW}', null
    );

    insert into review_candidates (
      id, user_id, processed_source_event_id, status, candidate_kind, occurred_at,
      amount, currency, description, confidence, created_at, updated_at, deleted_at
    ) values (
      'rc-stale', 'user-1', 'pse-stale', 'pending', 'transaction', '${NOW}',
      9000, 'COP', 'Stale review candidate', 0.25, '${NOW}', '${NOW}', null
    );

    insert into capture_evidence (
      id, user_id, source_family, evidence_type, scope, value, transaction_id, transfer_id,
      processed_email_id, processed_capture_id, processed_source_event_id, created_at, updated_at,
      deleted_at
    ) values (
      'ce-stale', 'user-1', 'email', 'counterparty_hint', 'merchant', 'Stale Cafe',
      null, null, null, null, 'pse-stale', '${NOW}', '${NOW}', null
    );

    insert into review_candidate_capture_evidence (
      id, user_id, review_candidate_id, capture_evidence_id, created_at, deleted_at
    ) values ('rcce-stale', 'user-1', 'rc-stale', 'ce-stale', '${NOW}', null);
  `);
}

function seedCaptureAndReviewState() {
  seedProcessedCaptures();
  seedProcessedSourceEventsAndReviewCandidates();
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

function seedProcessedSourceEventsAndReviewCandidates() {
  sourceSqlite.exec(`
    insert into processed_source_events (
      id, user_id, source_family, source_id, source_event_id, status, failure_reason,
      received_at, processed_at, created_at, updated_at, deleted_at
    ) values (
      'pse-1', 'user-1', 'email', 'gmail-primary', 'gmail-message-1',
      'needs_review', 'ambiguous_account', '${NOW}', '${NOW}', '${NOW}', '${NOW}', null
    );

    insert into review_candidates (
      id, user_id, processed_source_event_id, status, candidate_kind, occurred_at,
      amount, currency, description, confidence, created_at, updated_at, deleted_at
    ) values (
      'rc-1', 'user-1', 'pse-1', 'pending', 'transaction', '${NOW}',
      12500, 'COP', 'Low confidence cafe capture', 0.42, '${NOW}', '${NOW}', null
    );
  `);
}

function seedCaptureEvidence() {
  sourceSqlite.exec(`
    insert into capture_evidence (
      id, user_id, source_family, evidence_type, scope, value, transaction_id, transfer_id,
      processed_email_id, processed_capture_id, processed_source_event_id, created_at, updated_at,
      deleted_at
    ) values
      ('ce-email', 'user-1', 'gmail', 'last4', 'last4', '1234', 'txn-1', null, 'email-1', null, null, '${NOW}', '${NOW}', null),
      ('ce-capture', 'user-1', 'push', 'alias_token', 'alias', 'Broker', null, 'trf-1', null, 'capture-1', null, '${NOW}', '${NOW}', null),
      ('ce-review', 'user-1', 'email', 'counterparty_hint', 'merchant', 'Cafe', null, null, null, null, 'pse-1', '${NOW}', '${NOW}', null);

    insert into review_candidate_capture_evidence (
      id, user_id, review_candidate_id, capture_evidence_id, created_at, deleted_at
    ) values ('rcce-1', 'user-1', 'rc-1', 'ce-review', '${NOW}', null);
  `);
}

function seedDismissalsAndConflicts() {
  sourceSqlite.exec(`
    insert into account_suggestion_dismissals (
      id, user_id, scope, value, dismissed_score, created_at, updated_at, deleted_at
    ) values ('dismissal-1', 'user-1', 'last4', '9999', 70, '${NOW}', '${NOW}', null);  `);
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
  expect(targetDb.select().from(processedSourceEvents).all()).toEqual(
    sourceDb.select().from(processedSourceEvents).all()
  );
  expect(targetDb.select().from(reviewCandidates).all()).toEqual(
    sourceDb.select().from(reviewCandidates).all()
  );
  expect(targetDb.select().from(reviewCandidateCaptureEvidence).all()).toEqual(
    sourceDb.select().from(reviewCandidateCaptureEvidence).all()
  );
  expect(targetDb.select().from(accountSuggestionDismissals).all()).toEqual(
    sourceDb.select().from(accountSuggestionDismissals).all()
  );
}

function expectRestoredRowsReplacedStaleState() {
  expect(targetDb.select().from(userCategories).all()).toEqual(
    sourceDb.select().from(userCategories).all()
  );
  expect(targetDb.select().from(financialAccounts).all()).toEqual(
    sourceDb.select().from(financialAccounts).all()
  );
  expect(targetDb.select().from(transactions).all()).toEqual(
    sourceDb.select().from(transactions).all()
  );
  expect(targetDb.select().from(processedSourceEvents).all()).toEqual(
    sourceDb.select().from(processedSourceEvents).all()
  );
  expect(targetDb.select().from(reviewCandidates).all()).toEqual(
    sourceDb.select().from(reviewCandidates).all()
  );
  expect(targetDb.select().from(captureEvidence).all()).toEqual(
    sourceDb.select().from(captureEvidence).all()
  );
  expect(targetDb.select().from(reviewCandidateCaptureEvidence).all()).toEqual(
    sourceDb.select().from(reviewCandidateCaptureEvidence).all()
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
      financialAccounts: Array.from({ length: 51 }, (_, index) => ({
        ...rollbackAccountRow(`fa-${index}`),
        isDefault: index === 0,
      })),
    }),
  };
}

function validSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: NOW,
    data: emptySnapshotData(overrides),
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

function userCategoryRow(id = "uc-food") {
  return {
    id,
    userId: "user-1",
    name: "Work lunches",
    iconName: "utensils",
    colorHex: "#2F80ED",
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function transactionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "txn-1",
    userId: "user-1",
    type: "expense",
    amount: 42000,
    categoryId: "uc-food",
    description: "Lunch",
    counterpartyName: null,
    date: "2026-04-20",
    accountId: "fa-rollback",
    accountAttributionState: "confirmed",
    supersededAt: null,
    supersededByTransferId: null,
    createdAt: NOW,
    updatedAt: NOW,
    voidedAt: null,
    source: "manual",
    ...overrides,
  };
}

function transferRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "trf-1",
    userId: "user-1",
    amount: 100000,
    fromAccountId: "fa-rollback",
    toAccountId: null,
    fromExternalLabel: null,
    toExternalLabel: "Broker",
    description: "Investment",
    date: "2026-04-21",
    source: "manual",
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function openingBalanceRow(id = "ob-1") {
  return {
    id,
    userId: "user-1",
    accountId: "fa-rollback",
    amount: 250000,
    effectiveDate: "2026-04-01",
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function processedEmailRow() {
  return {
    id: "email-1",
    externalId: "provider-message-1",
    provider: "gmail",
    status: "success",
    failureReason: null,
    subject: "Purchase alert",
    rawBodyPreview: "Paid with card ending 1234",
    receivedAt: NOW,
    transactionId: "txn-1",
    confidence: 0.9,
    createdAt: NOW,
    rawBody: "Paid with card ending 1234 at Store",
    retryCount: 0,
    nextRetryAt: null,
  };
}

function processedSourceEventRow(status: string, id = `pse-${status}`) {
  return {
    id,
    userId: "user-1",
    sourceFamily: "email",
    sourceId: "gmail-primary",
    sourceEventId: `gmail-message-${status}`,
    status,
    failureReason: null,
    receivedAt: NOW,
    processedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function captureEvidenceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ce-1",
    userId: "user-1",
    sourceFamily: "gmail",
    evidenceType: "last4",
    scope: "last4",
    value: "1234",
    transactionId: "txn-1",
    transferId: null,
    processedEmailId: "email-1",
    processedCaptureId: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function withoutKeys<Row extends Record<string, unknown>>(row: Row, keys: readonly (keyof Row)[]) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !keys.includes(key as keyof Row))
  );
}

function createCappedInsertDb(maxRowsPerInsert: number) {
  let insertedRows = 0;
  const tx = {
    delete: () => ({ run: () => undefined, where: () => ({ run: () => undefined }) }),
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

function createFailingInsertDb(tableName: string) {
  return {
    transaction: (callback: (tx: typeof targetDb) => unknown) =>
      targetDb.transaction((tx) => {
        const failingTx = Object.create(tx) as typeof targetDb;
        failingTx.insert = ((table: Parameters<typeof tx.insert>[0]) => {
          if (getTableName(table) === tableName) {
            return {
              values: () => ({
                run: () => {
                  throw new Error(`Injected ${tableName} insert failure`);
                },
              }),
            };
          }
          return tx.insert(table);
        }) as typeof tx.insert;

        return callback(failingTx);
      }),
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
        processedSourceEvents: expect.any(Array),
        reviewCandidates: expect.any(Array),
        reviewCandidateCaptureEvidence: expect.any(Array),
      },
    });
    expect(snapshot.data.transfers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "trf-deleted",
          deletedAt: NOW,
        }),
      ])
    );
    expect(snapshot.data.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "txn-voided",
          voidedAt: NOW,
        }),
      ])
    );
    expect(snapshot.data.reviewCandidates).toEqual([
      expect.objectContaining({
        id: "rc-1",
        processedSourceEventId: "pse-1",
      }),
    ]);
    expectRestoredLedgerToMatchSource();
  });

  it("replaces existing local ledger rows atomically during restore", () => {
    seedLocalLedgerFixture();
    const snapshot = exportLocalLedgerBackupSnapshot(sourceDb as any, { exportedAt: NOW });
    seedStaleLocalLedgerRows();

    importLocalLedgerBackupSnapshot(targetDb as any, snapshot);

    expectRestoredRowsReplacedStaleState();
  });

  it("preserves other users when restoring one user's local ledger rows", () => {
    seedLocalLedgerFixture();
    const snapshot = exportLocalLedgerBackupSnapshot(sourceDb as any, { exportedAt: NOW });

    targetSqlite.exec(`
      insert into user_categories (
        id, user_id, name, icon_name, color_hex, created_at, updated_at, deleted_at
      ) values ('uc-other', 'user-2', 'Other user food', 'utensils', '#222222', '${NOW}', '${NOW}', null);

      insert into financial_accounts (
        id, user_id, name, kind, is_default, statement_closing_day, payment_due_day,
        created_at, updated_at, deleted_at
      ) values ('fa-other', 'user-2', 'Other wallet', 'wallet', 1, null, null, '${NOW}', '${NOW}', null);
    `);

    importLocalLedgerBackupSnapshot(targetDb as any, snapshot);

    expect(targetDb.select().from(userCategories).all()).toEqual(
      expect.arrayContaining([
        ...sourceDb.select().from(userCategories).all(),
        expect.objectContaining({ id: "uc-other", userId: "user-2" }),
      ])
    );
    expect(targetDb.select().from(userCategories).all()).toHaveLength(2);
    expect(targetDb.select().from(financialAccounts).all()).toEqual(
      expect.arrayContaining([
        ...sourceDb.select().from(financialAccounts).all(),
        expect.objectContaining({ id: "fa-other", userId: "user-2" }),
      ])
    );
    expect(targetDb.select().from(financialAccounts).all()).toHaveLength(2);
  });

  it("rolls back cleared rows when restore insertion fails inside the transaction", () => {
    seedLocalLedgerFixture();
    const snapshot = exportLocalLedgerBackupSnapshot(sourceDb as any, { exportedAt: NOW });

    targetSqlite.exec(`
      insert into user_categories (
        id, user_id, name, icon_name, color_hex, created_at, updated_at, deleted_at
      ) values ('uc-stale', 'user-1', 'Stale category', 'archive', '#111111', '${NOW}', '${NOW}', null);
    `);
    const beforeRestore = targetDb.select().from(userCategories).all();
    const failingDb = createFailingInsertDb("financial_accounts");

    expect(() => importLocalLedgerBackupSnapshot(failingDb as any, snapshot)).toThrow(
      "Injected financial_accounts insert failure"
    );

    expect(targetDb.select().from(userCategories).all()).toEqual(beforeRestore);
  });

  it("excludes cache, UI state, and derived read-model tables from the snapshot", () => {
    seedLocalLedgerFixture();
    seedExcludedRows();

    const snapshot = exportLocalLedgerBackupSnapshot(sourceDb as any, { exportedAt: NOW });

    expect(Object.keys(snapshot.data).sort()).toEqual([
      "accountSuggestionDismissals",
      "budgets",
      "captureEvidence",
      "financialAccountIdentifiers",
      "financialAccounts",
      "goalContributions",
      "goals",
      "openingBalances",
      "processedCaptures",
      "processedEmails",
      "processedSourceEvents",
      "reviewCandidateCaptureEvidence",
      "reviewCandidates",
      "transactions",
      "transfers",
      "userCategories",
    ]);
    expect(JSON.stringify(snapshot.data)).not.toContain("notif-1");
    expect(JSON.stringify(snapshot.data)).not.toContain("memory-1");
    expect(sourceDb.select().from(notifications).all()).toHaveLength(1);
    expect(sourceDb.select().from(userMemories).all()).toHaveLength(1);
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

  it("validates supported snapshot versions before backup upload", () => {
    expect(() =>
      validateBackupSnapshot({
        version: 999,
        exportedAt: NOW,
        data: {},
      })
    ).toThrow("Unsupported local ledger backup snapshot version: 999");
  });

  it("rejects malformed table rows before backup upload", () => {
    expect(() =>
      validateBackupSnapshot(
        validSnapshot({
          financialAccounts: [{ ...rollbackAccountRow(), name: null }],
        })
      )
    ).toThrow("Malformed local ledger backup row: name must be a non-empty string");
  });

  it("accepts the expanded processed source-event status set", () => {
    const statuses = ["processed", "needs_review", "failed", "duplicate", "dismissed"];
    const snapshot = validateBackupSnapshot(
      validSnapshot({
        processedSourceEvents: statuses.map((status) => processedSourceEventRow(status)),
      })
    );

    expect(snapshot.data.processedSourceEvents.map((row) => row.status)).toEqual(statuses);
  });

  it("rejects unsupported processed source-event statuses", () => {
    expect(() =>
      validateBackupSnapshot(
        validSnapshot({
          processedSourceEvents: [processedSourceEventRow("ignored")],
        })
      )
    ).toThrow("Malformed local ledger backup row: status is not supported");
  });

  it("accepts legacy version 1 rows that predate additive defaulted columns", () => {
    const legacyTransaction = {
      ...withoutKeys(transactionRow(), [
        "counterpartyName",
        "supersededByTransferId",
        "voidedAt",
        "source",
      ]),
      deletedAt: null,
    };
    const snapshot = validSnapshot({
      userCategories: [userCategoryRow()],
      financialAccounts: [
        withoutKeys(rollbackAccountRow(), ["statementClosingDay", "paymentDueDay"]),
      ],
      transactions: [legacyTransaction],
      processedEmails: [withoutKeys(processedEmailRow(), ["rawBody", "retryCount", "nextRetryAt"])],
    });

    expect(validateBackupSnapshot(snapshot)).toEqual({
      ...snapshot,
      data: {
        ...snapshot.data,
        transactions: [
          {
            ...withoutKeys(legacyTransaction, ["deletedAt"]),
            counterpartyName: null,
            supersededByTransferId: null,
            voidedAt: null,
            source: "manual",
          },
        ],
        processedSourceEvents: [],
        reviewCandidates: [],
        reviewCandidateCaptureEvidence: [],
      },
    });
  });

  it("normalizes legacy non-manual transaction source values as closed capture categories", () => {
    const legacyTransaction = {
      ...withoutKeys(transactionRow({ source: "email_gmail" }), [
        "counterpartyName",
        "supersededByTransferId",
        "voidedAt",
      ]),
      deletedAt: null,
    };

    const snapshot = validateBackupSnapshot(
      validSnapshot({
        userCategories: [userCategoryRow()],
        financialAccounts: [rollbackAccountRow()],
        transactions: [legacyTransaction],
      })
    );

    expect(snapshot.data.transactions[0]).toEqual(
      expect.objectContaining({ source: "email_capture" })
    );
  });

  it("defaults only missing legacy transfer source values before validation", () => {
    const legacyTransfer = withoutKeys(transferRow(), ["source"]);

    const snapshot = validateBackupSnapshot(
      validSnapshot({
        financialAccounts: [rollbackAccountRow()],
        transfers: [legacyTransfer],
      })
    );

    expect(snapshot.data.transfers[0]).toEqual(expect.objectContaining({ source: "manual" }));
    expect(() =>
      validateBackupSnapshot(
        validSnapshot({
          financialAccounts: [rollbackAccountRow()],
          transfers: [transferRow({ source: "misspelled-source" })],
        })
      )
    ).toThrow("Malformed local ledger backup row: source is not supported");
  });

  it("rejects duplicate primary IDs inside backed-up collections", () => {
    expect(() =>
      validateBackupSnapshot(
        validSnapshot({
          financialAccounts: [rollbackAccountRow(), rollbackAccountRow()],
        })
      )
    ).toThrow("Duplicate local ledger backup primary id in financialAccounts");
  });

  it("rejects unresolved references inside the snapshot", () => {
    expect(() =>
      validateBackupSnapshot(
        validSnapshot({
          userCategories: [userCategoryRow()],
          financialAccounts: [rollbackAccountRow()],
          transactions: [transactionRow({ accountId: "fa-missing" })],
        })
      )
    ).toThrow("Local ledger backup has unresolved reference: transactions.accountId");
  });

  it("rejects unresolved superseding transfer references inside transaction rows", () => {
    expect(() =>
      validateBackupSnapshot(
        validSnapshot({
          userCategories: [userCategoryRow()],
          financialAccounts: [rollbackAccountRow()],
          transactions: [transactionRow({ supersededByTransferId: "transfer-missing" })],
        })
      )
    ).toThrow("Local ledger backup has unresolved reference: transactions.supersededByTransferId");
  });

  it("rejects snapshot rows that violate local ledger invariants", () => {
    expect(() =>
      validateBackupSnapshot(
        validSnapshot({
          financialAccounts: [rollbackAccountRow()],
          openingBalances: [openingBalanceRow("ob-1"), openingBalanceRow("ob-2")],
        })
      )
    ).toThrow("Local ledger backup has multiple active opening balances for an account");
  });

  it("rejects capture evidence with invalid source or financial links", () => {
    expect(() =>
      validateBackupSnapshot(
        validSnapshot({
          userCategories: [userCategoryRow()],
          financialAccounts: [rollbackAccountRow()],
          transactions: [transactionRow()],
          processedEmails: [processedEmailRow()],
          captureEvidence: [captureEvidenceRow({ processedCaptureId: "capture-1" })],
        })
      )
    ).toThrow("Local ledger backup has unresolved reference: captureEvidence.processedCaptureId");
  });
});
