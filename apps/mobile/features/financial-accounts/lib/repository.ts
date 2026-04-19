import { and, desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { enqueueSync, financialAccounts } from "@/shared/db";
import { useLocaleStore } from "@/shared/i18n";
import { generateSyncQueueId, toIsoDateTime } from "@/shared/lib";
import type { IsoDateTime } from "@/shared/types/branded";
import type { FinancialAccountKind } from "../schema";
import { buildDefaultFinancialAccountId } from "./default-account";

export type FinancialAccountRow = typeof financialAccounts.$inferInsert;

type EnsureDefaultFinancialAccountOptions = {
  readonly now?: IsoDateTime;
  readonly name?: string;
};

const DEFAULT_FINANCIAL_ACCOUNT_KIND: FinancialAccountKind = "cash";

function getDefaultFinancialAccountName() {
  return useLocaleStore.getState().t("financialAccounts.defaultName");
}

function getDefaultFinancialAccountCreateTime(now?: IsoDateTime) {
  return now ?? toIsoDateTime(new Date());
}

function getActiveFinancialAccountRowsForUser(db: AnyDb, userId: FinancialAccountRow["userId"]) {
  return db
    .select()
    .from(financialAccounts)
    .where(and(eq(financialAccounts.userId, userId), isNull(financialAccounts.deletedAt)))
    .orderBy(desc(financialAccounts.isDefault), desc(financialAccounts.updatedAt))
    .all();
}

function findCanonicalFinancialAccount(
  rows: readonly FinancialAccountRow[],
  userId: FinancialAccountRow["userId"]
) {
  const canonicalId = buildDefaultFinancialAccountId(userId);
  return rows.find((row) => row.id === canonicalId) ?? null;
}

function findChosenDefaultFinancialAccount(
  rows: readonly FinancialAccountRow[],
  userId: FinancialAccountRow["userId"]
) {
  const canonicalDefault = rows.find(
    (row) => row.id === buildDefaultFinancialAccountId(userId) && row.isDefault
  );
  if (canonicalDefault) {
    return canonicalDefault;
  }

  return rows.find((row) => row.isDefault) ?? findCanonicalFinancialAccount(rows, userId);
}

export function getFinancialAccountById(db: AnyDb, id: FinancialAccountRow["id"]) {
  const rows = db.select().from(financialAccounts).where(eq(financialAccounts.id, id)).all();
  return rows[0] ?? null;
}

export function upsertFinancialAccount(db: AnyDb, row: FinancialAccountRow) {
  db.insert(financialAccounts)
    .values(row)
    .onConflictDoUpdate({
      target: financialAccounts.id,
      set: {
        userId: row.userId,
        name: row.name,
        kind: row.kind,
        isDefault: row.isDefault,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export function saveFinancialAccount(db: AnyDb, row: FinancialAccountRow) {
  const existing = getFinancialAccountById(db, row.id);

  upsertFinancialAccount(db, row);

  enqueueSync(db, {
    id: generateSyncQueueId(),
    tableName: "financialAccounts",
    rowId: row.id,
    operation: existing ? "update" : "insert",
    createdAt: row.updatedAt,
  });
}

export function getFinancialAccountsForUser(db: AnyDb, userId: FinancialAccountRow["userId"]) {
  return getActiveFinancialAccountRowsForUser(db, userId);
}

export function getDefaultFinancialAccountForUser(
  db: AnyDb,
  userId: FinancialAccountRow["userId"]
) {
  return findChosenDefaultFinancialAccount(
    getActiveFinancialAccountRowsForUser(db, userId),
    userId
  );
}

export function ensureDefaultFinancialAccount(
  db: AnyDb,
  userId: FinancialAccountRow["userId"],
  options: EnsureDefaultFinancialAccountOptions = {}
) {
  const now = getDefaultFinancialAccountCreateTime(options.now);
  const name = options.name ?? getDefaultFinancialAccountName();

  return db.transaction((tx) => {
    const activeRows = getActiveFinancialAccountRowsForUser(tx, userId);
    const chosenDefault = findChosenDefaultFinancialAccount(activeRows, userId);

    if (chosenDefault) {
      return chosenDefault;
    }

    const canonicalId = buildDefaultFinancialAccountId(userId);
    const existingCanonical = getFinancialAccountById(tx, canonicalId);
    const row = {
      id: canonicalId,
      userId,
      name: existingCanonical?.name || name,
      kind: existingCanonical?.kind || DEFAULT_FINANCIAL_ACCOUNT_KIND,
      isDefault: true,
      createdAt: existingCanonical?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    } satisfies FinancialAccountRow;

    saveFinancialAccount(tx, row);
    return row;
  });
}
