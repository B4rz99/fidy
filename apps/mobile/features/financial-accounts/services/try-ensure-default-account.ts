import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib/sentry";
import type { UserId } from "@/shared/types/branded";
import { ensureDefaultFinancialAccount, type FinancialAccountRow } from "../lib/repository";

export function tryEnsureDefaultFinancialAccount(
  db: AnyDb,
  userId: UserId
): FinancialAccountRow | null {
  try {
    return ensureDefaultFinancialAccount(db, userId);
  } catch (error) {
    captureError(error);
    return null;
  }
}
