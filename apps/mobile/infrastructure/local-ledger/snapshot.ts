import type { SQL } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";
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
  processedSourceEvents,
  reviewCandidateCaptureEvidence,
  reviewCandidates,
  transactions,
  transfers,
  userCategories,
} from "@/shared/db/schema";
import type { UserId } from "@/shared/types/branded";
import { requireUserId } from "@/shared/types/assertions";
import {
  type BackupSnapshot,
  type LocalLedgerBackupSnapshotData,
  LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION,
  validateBackupSnapshot,
} from "@/local-ledger/snapshot.public";

export { LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION, validateBackupSnapshot };
export type { BackupSnapshot, LocalLedgerBackupSnapshotData };

export type ExportLocalLedgerBackupSnapshotOptions = {
  readonly exportedAt: string;
};

export type ImportLocalLedgerBackupSnapshotOptions = {
  readonly userId?: UserId;
};

const MAX_ROWS_PER_INSERT = 50;
const USER_SCOPED_BACKUP_DATA_KEYS = [
  "transactions",
  "transfers",
  "userCategories",
  "financialAccounts",
  "openingBalances",
  "budgets",
  "goals",
  "goalContributions",
  "captureEvidence",
  "financialAccountIdentifiers",
  "accountSuggestionDismissals",
  "processedSourceEvents",
  "reviewCandidates",
  "reviewCandidateCaptureEvidence",
] as const;

export function exportLocalLedgerBackupSnapshot(
  db: BackupSelectDb,
  options: ExportLocalLedgerBackupSnapshotOptions
): BackupSnapshot {
  return {
    version: LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION,
    exportedAt: options.exportedAt,
    data: {
      transactions: selectRows(db, transactions) as readonly (typeof transactions.$inferSelect)[],
      transfers: selectRows(db, transfers) as readonly (typeof transfers.$inferSelect)[],
      userCategories: selectRows(
        db,
        userCategories
      ) as readonly (typeof userCategories.$inferSelect)[],
      financialAccounts: selectRows(
        db,
        financialAccounts
      ) as readonly (typeof financialAccounts.$inferSelect)[],
      openingBalances: selectRows(
        db,
        openingBalances
      ) as readonly (typeof openingBalances.$inferSelect)[],
      budgets: selectRows(db, budgets) as readonly (typeof budgets.$inferSelect)[],
      goals: selectRows(db, goals) as readonly (typeof goals.$inferSelect)[],
      goalContributions: selectRows(
        db,
        goalContributions
      ) as readonly (typeof goalContributions.$inferSelect)[],
      captureEvidence: selectRows(
        db,
        captureEvidence
      ) as readonly (typeof captureEvidence.$inferSelect)[],
      financialAccountIdentifiers: selectRows(
        db,
        financialAccountIdentifiers
      ) as readonly (typeof financialAccountIdentifiers.$inferSelect)[],
      accountSuggestionDismissals: selectRows(
        db,
        accountSuggestionDismissals
      ) as readonly (typeof accountSuggestionDismissals.$inferSelect)[],
      processedEmails: selectRows(
        db,
        processedEmails
      ) as readonly (typeof processedEmails.$inferSelect)[],
      processedCaptures: selectRows(
        db,
        processedCaptures
      ) as readonly (typeof processedCaptures.$inferSelect)[],
      processedSourceEvents: selectRows(
        db,
        processedSourceEvents
      ) as readonly (typeof processedSourceEvents.$inferSelect)[],
      reviewCandidates: selectRows(
        db,
        reviewCandidates
      ) as readonly (typeof reviewCandidates.$inferSelect)[],
      reviewCandidateCaptureEvidence: selectRows(
        db,
        reviewCandidateCaptureEvidence
      ) as readonly (typeof reviewCandidateCaptureEvidence.$inferSelect)[],
    },
  };
}

export function importLocalLedgerBackupSnapshot(
  db: BackupDb,
  snapshot: unknown,
  options: ImportLocalLedgerBackupSnapshotOptions = {}
) {
  const validatedSnapshot = validateBackupSnapshot(snapshot);
  const userIds = options.userId
    ? [options.userId]
    : collectSnapshotUserIds(validatedSnapshot.data);

  db.transaction((tx) => {
    clearSnapshotTables(tx, userIds);
    insertRows(tx, userCategories, validatedSnapshot.data.userCategories);
    insertRows(tx, financialAccounts, validatedSnapshot.data.financialAccounts);
    insertRows(tx, financialAccountIdentifiers, validatedSnapshot.data.financialAccountIdentifiers);
    insertRows(tx, openingBalances, validatedSnapshot.data.openingBalances);
    insertRows(tx, transactions, validatedSnapshot.data.transactions);
    insertRows(tx, transfers, validatedSnapshot.data.transfers);
    insertRows(tx, budgets, validatedSnapshot.data.budgets);
    insertRows(tx, goals, validatedSnapshot.data.goals);
    insertRows(tx, goalContributions, validatedSnapshot.data.goalContributions);
    insertRows(tx, processedEmails, validatedSnapshot.data.processedEmails);
    insertRows(tx, processedCaptures, validatedSnapshot.data.processedCaptures);
    insertRows(tx, processedSourceEvents, validatedSnapshot.data.processedSourceEvents);
    insertRows(tx, reviewCandidates, validatedSnapshot.data.reviewCandidates);
    insertRows(tx, captureEvidence, validatedSnapshot.data.captureEvidence);
    insertRows(
      tx,
      reviewCandidateCaptureEvidence,
      validatedSnapshot.data.reviewCandidateCaptureEvidence
    );
    insertRows(tx, accountSuggestionDismissals, validatedSnapshot.data.accountSuggestionDismissals);
  });
}

function collectSnapshotUserIds(data: LocalLedgerBackupSnapshotData): readonly UserId[] {
  return Array.from(
    new Set(USER_SCOPED_BACKUP_DATA_KEYS.flatMap((key) => data[key].map((row) => row.userId)))
  ).map(requireUserId);
}

function clearSnapshotTables(db: BackupDeleteDb, userIds: readonly UserId[]) {
  if (userIds.length === 0) return;

  [
    reviewCandidateCaptureEvidence,
    captureEvidence,
    reviewCandidates,
    processedSourceEvents,
    accountSuggestionDismissals,
    goalContributions,
    goals,
    budgets,
    transfers,
    transactions,
    openingBalances,
    financialAccountIdentifiers,
    financialAccounts,
    userCategories,
  ].forEach((table) => {
    db.delete(table).where(toUserIdCondition(table.userId, userIds)).run();
  });

  [processedCaptures, processedEmails].forEach((table) => {
    db.delete(table).run();
  });
}

function toUserIdCondition(column: UserScopedBackupTable["userId"], userIds: readonly UserId[]) {
  const [firstUserId] = userIds;
  return userIds.length === 1 && firstUserId !== undefined
    ? eq(column, firstUserId)
    : inArray(column, userIds);
}

function insertRows(
  db: BackupInsertDb,
  table: BackupTable,
  rows: readonly Record<string, unknown>[]
) {
  chunkRows(rows).forEach((chunk) => {
    db.insert(table).values(chunk).run();
  });
}

function chunkRows(rows: readonly Record<string, unknown>[]) {
  return Array.from({ length: Math.ceil(rows.length / MAX_ROWS_PER_INSERT) }, (_, index) =>
    rows.slice(index * MAX_ROWS_PER_INSERT, (index + 1) * MAX_ROWS_PER_INSERT)
  );
}

function selectRows(db: BackupSelectDb, table: BackupTable): readonly Record<string, unknown>[] {
  return db.select().from(table).all();
}

type BackupTable =
  | typeof accountSuggestionDismissals
  | typeof budgets
  | typeof captureEvidence
  | typeof financialAccountIdentifiers
  | typeof financialAccounts
  | typeof goalContributions
  | typeof goals
  | typeof openingBalances
  | typeof processedCaptures
  | typeof processedEmails
  | typeof processedSourceEvents
  | typeof reviewCandidateCaptureEvidence
  | typeof reviewCandidates
  | typeof transactions
  | typeof transfers
  | typeof userCategories;

type UserScopedBackupTable = Exclude<
  BackupTable,
  typeof processedCaptures | typeof processedEmails
>;

type BackupSelectDb = {
  readonly select: () => {
    readonly from: (table: BackupTable) => {
      readonly all: () => Record<string, unknown>[];
    };
  };
};

type BackupInsertDb = {
  readonly insert: (table: BackupTable) => {
    readonly values: (rows: Record<string, unknown>[]) => { readonly run: () => unknown };
  };
};

type BackupDeleteDb = {
  readonly delete: (table: BackupTable) => {
    readonly where: (condition: SQL) => { readonly run: () => unknown };
    readonly run: () => unknown;
  };
};

type BackupDb = BackupSelectDb &
  BackupInsertDb & {
    readonly transaction: (callback: (tx: BackupInsertDb & BackupDeleteDb) => unknown) => unknown;
  };
