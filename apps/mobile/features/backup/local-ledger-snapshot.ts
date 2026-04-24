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

export const LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION = 1;

export type BackupSnapshot = {
  readonly version: typeof LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION;
  readonly exportedAt: string;
  readonly data: LocalLedgerBackupSnapshotData;
};

export type ExportLocalLedgerBackupSnapshotOptions = {
  readonly exportedAt: string;
};

const MAX_ROWS_PER_INSERT = 50;

export function exportLocalLedgerBackupSnapshot(
  db: BackupDb,
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
      syncConflicts: selectRows(
        db,
        syncConflicts
      ) as readonly (typeof syncConflicts.$inferSelect)[],
    },
  };
}

export function importLocalLedgerBackupSnapshot(db: BackupDb, snapshot: unknown) {
  const validatedSnapshot = parseBackupSnapshot(snapshot);

  db.transaction((tx) => {
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
    insertRows(tx, captureEvidence, validatedSnapshot.data.captureEvidence);
    insertRows(tx, accountSuggestionDismissals, validatedSnapshot.data.accountSuggestionDismissals);
    insertRows(tx, syncConflicts, validatedSnapshot.data.syncConflicts);
  });
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

function selectRows(db: BackupDb, table: BackupTable): readonly Record<string, unknown>[] {
  return db.select().from(table).all();
}

function parseBackupSnapshot(snapshot: unknown): BackupSnapshot {
  assertSnapshotRecord(snapshot);
  assertSupportedSnapshotVersion(snapshot);
  assertVersionOneSnapshotShape(snapshot);
  return snapshot as BackupSnapshot;
}

function assertSnapshotRecord(snapshot: unknown): asserts snapshot is Record<string, unknown> {
  if (!isRecord(snapshot)) {
    throw new Error("Malformed local ledger backup snapshot");
  }
}

function assertSupportedSnapshotVersion(snapshot: Record<string, unknown>) {
  if (snapshot.version !== LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported local ledger backup snapshot version: ${String(snapshot.version)}`
    );
  }
}

function assertVersionOneSnapshotShape(snapshot: Record<string, unknown>) {
  const data = snapshot.data;
  if (typeof snapshot.exportedAt !== "string" || !isRecord(data)) {
    throw new Error("Malformed local ledger backup snapshot");
  }

  if (!hasBackupTableArrays(data) || !hasBackupTableRows(data)) {
    throw new Error("Malformed local ledger backup snapshot");
  }
}

function hasBackupTableArrays(data: Record<string, unknown>) {
  return BACKUP_DATA_KEYS.every((key) => Array.isArray(data[key]));
}

function hasBackupTableRows(data: Record<string, unknown>) {
  return BACKUP_DATA_KEYS.every((key) => {
    const rows = data[key];
    return Array.isArray(rows) && rows.every(isRecord);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const BACKUP_DATA_KEYS = [
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
  "processedEmails",
  "processedCaptures",
  "syncConflicts",
] as const;

type LocalLedgerBackupSnapshotData = {
  readonly transactions: readonly (typeof transactions.$inferSelect)[];
  readonly transfers: readonly (typeof transfers.$inferSelect)[];
  readonly userCategories: readonly (typeof userCategories.$inferSelect)[];
  readonly financialAccounts: readonly (typeof financialAccounts.$inferSelect)[];
  readonly openingBalances: readonly (typeof openingBalances.$inferSelect)[];
  readonly budgets: readonly (typeof budgets.$inferSelect)[];
  readonly goals: readonly (typeof goals.$inferSelect)[];
  readonly goalContributions: readonly (typeof goalContributions.$inferSelect)[];
  readonly captureEvidence: readonly (typeof captureEvidence.$inferSelect)[];
  readonly financialAccountIdentifiers: readonly (typeof financialAccountIdentifiers.$inferSelect)[];
  readonly accountSuggestionDismissals: readonly (typeof accountSuggestionDismissals.$inferSelect)[];
  readonly processedEmails: readonly (typeof processedEmails.$inferSelect)[];
  readonly processedCaptures: readonly (typeof processedCaptures.$inferSelect)[];
  readonly syncConflicts: readonly (typeof syncConflicts.$inferSelect)[];
};

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
  | typeof syncConflicts
  | typeof transactions
  | typeof transfers
  | typeof userCategories;

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

type BackupDb = BackupSelectDb &
  BackupInsertDb & {
    readonly transaction: (callback: (tx: BackupInsertDb) => unknown) => unknown;
  };
