import { and, desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { enqueueSync, financialAccounts } from "@/shared/db";
import { generateSyncQueueId } from "@/shared/lib";

export type FinancialAccountRow = typeof financialAccounts.$inferInsert;

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
  return db
    .select()
    .from(financialAccounts)
    .where(and(eq(financialAccounts.userId, userId), isNull(financialAccounts.deletedAt)))
    .orderBy(desc(financialAccounts.isDefault), desc(financialAccounts.updatedAt))
    .all();
}
