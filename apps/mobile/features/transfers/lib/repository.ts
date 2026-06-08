import { and, desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { transfers } from "@/shared/db/schema";

export type TransferRow = typeof transfers.$inferSelect;
type GetTransfersPageInput = {
  readonly db: AnyDb;
  readonly userId: TransferRow["userId"];
  readonly limit: number;
  readonly offset: number;
};

function queryActiveTransfers(db: AnyDb, userId: TransferRow["userId"]) {
  return db
    .select()
    .from(transfers)
    .where(and(eq(transfers.userId, userId), isNull(transfers.voidedAt)))
    .orderBy(desc(transfers.date), desc(transfers.updatedAt), desc(transfers.id));
}

export function getTransfersPaginated(input: GetTransfersPageInput) {
  const { db, userId, limit, offset } = input;
  return queryActiveTransfers(db, userId)
    .limit(limit + 1)
    .offset(offset)
    .all();
}
