import { and, desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { financialAccounts } from "@/shared/db";
import { useLocaleStore } from "@/shared/i18n";
import { toIsoDateTime } from "@/shared/lib";
import type { IsoDateTime } from "@/shared/types/branded";
import { buildDefaultFinancialAccountId } from "./default-account";
import {
  buildDefaultFinancialAccountRow,
  findCanonicalFinancialAccount,
  findExistingDefaultFinancialAccount,
  promoteFinancialAccountToDefault,
} from "./default-account-bootstrap";

export type FinancialAccountRow = typeof financialAccounts.$inferInsert;

type EnsureDefaultFinancialAccountOptions = {
  readonly now?: IsoDateTime;
  readonly name?: string;
};
type EnsureDefaultFinancialAccountContext = {
  readonly db: AnyDb;
  readonly userId: FinancialAccountRow["userId"];
  readonly now: IsoDateTime;
  readonly name: string;
};

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

function resolveExistingDefaultFinancialAccount(
  context: EnsureDefaultFinancialAccountContext
): FinancialAccountRow | null {
  const activeRows = getActiveFinancialAccountRowsForUser(context.db, context.userId);
  const existingDefault = findExistingDefaultFinancialAccount(activeRows);
  if (existingDefault) {
    return existingDefault;
  }

  const canonicalActive = findCanonicalFinancialAccount(activeRows, context.userId);
  if (!canonicalActive) {
    return null;
  }

  const promotedRow = promoteFinancialAccountToDefault(canonicalActive, context.now);
  saveFinancialAccount(context.db, promotedRow);
  return promotedRow;
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
        statementClosingDay: row.statementClosingDay,
        paymentDueDay: row.paymentDueDay,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export function saveFinancialAccount(db: AnyDb, row: FinancialAccountRow) {
  upsertFinancialAccount(db, row);
}

export function getFinancialAccountsForUser(db: AnyDb, userId: FinancialAccountRow["userId"]) {
  return getActiveFinancialAccountRowsForUser(db, userId);
}

export function getDefaultFinancialAccountForUser(
  db: AnyDb,
  userId: FinancialAccountRow["userId"]
) {
  return findExistingDefaultFinancialAccount(getActiveFinancialAccountRowsForUser(db, userId));
}

export function ensureDefaultFinancialAccount(
  db: AnyDb,
  userId: FinancialAccountRow["userId"],
  options: EnsureDefaultFinancialAccountOptions = {}
) {
  const context = {
    db,
    userId,
    now: getDefaultFinancialAccountCreateTime(options.now),
    name: options.name ?? getDefaultFinancialAccountName(),
  } satisfies EnsureDefaultFinancialAccountContext;

  return db.transaction((tx) => {
    const transactionContext = {
      ...context,
      db: tx,
    } satisfies EnsureDefaultFinancialAccountContext;
    const existingDefault = resolveExistingDefaultFinancialAccount(transactionContext);
    if (existingDefault) {
      return existingDefault;
    }

    const canonicalId = buildDefaultFinancialAccountId(transactionContext.userId);
    const existingCanonical = getFinancialAccountById(tx, canonicalId);
    const row = buildDefaultFinancialAccountRow(
      transactionContext.userId,
      transactionContext.now,
      transactionContext.name,
      existingCanonical
    );
    saveFinancialAccount(tx, row);
    return row;
  });
}
