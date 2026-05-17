import { and, eq, isNull } from "drizzle-orm";
import {
  createRecordTransactionUseCase,
  type LocalLedgerEntryId,
  type RecordTransactionAccepted,
  type RecordTransactionCommand,
  type RecordTransactionRejectCode,
} from "@/local-ledger/public";
import { isValidCategoryId } from "@/shared/categories";
import type { AnyDb } from "@/shared/db";
import { transactions, userCategories } from "@/shared/db/schema";
import { toIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import { parseDigitsToAmount } from "@/shared/lib/format-money";
import { requireIsoDate } from "@/shared/types/assertions";
import type {
  CategoryId,
  FinancialAccountId,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import { hasActiveFinancialAccount } from "./account-policy.ts";
import { toTransactionStorageRow } from "./transaction-storage";

export type ManualTransactionInput = {
  readonly type: "expense" | "income";
  readonly digits: string;
  readonly categoryId: CategoryId | null;
  readonly accountId: FinancialAccountId | null;
  readonly description: string;
  readonly date: Date;
};

export type RecordManualTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly transactionId: TransactionId;
  readonly input: ManualTransactionInput;
  readonly now: Date;
};

export type RecordAutomatedTransactionInput = {
  readonly db: AnyDb;
  readonly command: RecordTransactionCommand;
  readonly transactionId: TransactionId;
  readonly now: IsoDateTime;
  readonly afterRecord?: (tx: AnyDb, transaction: RecordTransactionAccepted) => void;
};

type CommitPolicyRejection = {
  readonly ok: false;
  readonly code: "account-not-usable" | "category-not-usable";
};

export function toLocalLedgerEntryId(transactionId: TransactionId): LocalLedgerEntryId {
  // Transaction-backed ledger entries use the persisted transaction ID as their ledger entry ID.
  return transactionId as unknown as LocalLedgerEntryId;
}

export type RecordManualTransactionResult =
  | { readonly success: true; readonly transaction: typeof transactions.$inferInsert }
  | { readonly success: false; readonly error: RecordManualTransactionError };

export type RecordManualTransactionError =
  | "accountNotUsable"
  | "amountNotPositive"
  | "categoryNotUsable"
  | "counterpartyNameTooLong"
  | "descriptionTooLong"
  | "futureDatedTransaction"
  | "missingAccount"
  | "missingCategory"
  | "manualSourceRequiresResolvedAccount";

export type RecordAutomatedTransactionResult =
  | {
      readonly success: true;
      readonly transaction: RecordTransactionAccepted;
      readonly transactionRow: typeof transactions.$inferInsert;
    }
  | { readonly success: false; readonly error: RecordTransactionRejectCode };

export const rejectionErrorMap: Record<RecordTransactionRejectCode, RecordManualTransactionError> =
  {
    "account-not-usable": "accountNotUsable",
    "category-not-usable": "categoryNotUsable",
    "counterparty-name-too-long": "counterpartyNameTooLong",
    "description-too-long": "descriptionTooLong",
    "future-dated-transaction": "futureDatedTransaction",
    "manual-source-requires-resolved-account": "manualSourceRequiresResolvedAccount",
    "missing-account": "missingAccount",
    "missing-category": "missingCategory",
    "non-positive-amount": "amountNotPositive",
  };

export function hasUsableCategory(db: AnyDb, userId: UserId, categoryId: CategoryId) {
  if (isValidCategoryId(categoryId)) return true;

  const rows = db
    .select({ id: userCategories.id })
    .from(userCategories)
    .where(
      and(
        eq(userCategories.id, categoryId),
        eq(userCategories.userId, userId),
        isNull(userCategories.deletedAt)
      )
    )
    .limit(1)
    .all();
  return rows.length > 0;
}

export function getCommitPolicyRejection(
  db: AnyDb,
  transaction: RecordTransactionAccepted
): CommitPolicyRejection | null {
  if (!hasActiveFinancialAccount(db, transaction.userId, transaction.accountId)) {
    return { ok: false, code: "account-not-usable" };
  }

  if (!hasUsableCategory(db, transaction.userId, transaction.categoryId)) {
    return { ok: false, code: "category-not-usable" };
  }

  return null;
}

export async function recordManualTransactionWithLocalLedger({
  db,
  userId,
  transactionId,
  input,
  now,
}: RecordManualTransactionInput): Promise<RecordManualTransactionResult> {
  const nowIso = toIsoDateTime(now);
  const recordTransaction = createRecordTransactionUseCase({
    ports: {
      canUseAccount: async ({ accountId }) => hasActiveFinancialAccount(db, userId, accountId),
      canUseCategory: async ({ categoryId }) => hasUsableCategory(db, userId, categoryId),
      commit: async (transaction) =>
        db.transaction((tx) => {
          const policyRejection = getCommitPolicyRejection(tx, transaction);
          if (policyRejection) return policyRejection;

          const row = toTransactionStorageRow({ transaction, now: nowIso });
          tx.insert(transactions).values(row).run();
          return { ok: true, transaction };
        }),
      generateEntryId: () => toLocalLedgerEntryId(transactionId),
      today: () => toIsoDate(now),
    },
  });

  const result = await recordTransaction({
    userId,
    type: input.type,
    amount: parseDigitsToAmount(input.digits),
    accountId: input.accountId,
    accountAttributionState: "confirmed",
    categoryId: input.categoryId,
    occurredOn: toIsoDate(input.date),
    description: input.description,
    counterpartyName: null,
    source: "manual",
  });

  return result.ok
    ? {
        success: true,
        transaction: toTransactionStorageRow({ transaction: result.transaction, now: nowIso }),
      }
    : { success: false, error: rejectionErrorMap[result.code] };
}

export async function recordAutomatedTransactionWithLocalLedger({
  db,
  command,
  transactionId,
  now,
  afterRecord,
}: RecordAutomatedTransactionInput): Promise<RecordAutomatedTransactionResult> {
  const recordTransaction = createRecordTransactionUseCase({
    ports: {
      canUseAccount: async ({ accountId }) =>
        hasActiveFinancialAccount(db, command.userId, accountId),
      canUseCategory: async ({ categoryId }) => hasUsableCategory(db, command.userId, categoryId),
      today: () => requireIsoDate(now.slice(0, 10)),
      generateEntryId: () => toLocalLedgerEntryId(transactionId),
      commit: async (transaction) =>
        db.transaction((tx) => {
          const policyRejection = getCommitPolicyRejection(tx, transaction);
          if (policyRejection) return policyRejection;

          tx.insert(transactions).values(toTransactionStorageRow({ transaction, now })).run();
          afterRecord?.(tx, transaction);
          return { ok: true, transaction };
        }),
    },
  });
  const result = await recordTransaction(command);

  return result.ok
    ? {
        success: true,
        transaction: result.transaction,
        transactionRow: toTransactionStorageRow({ transaction: result.transaction, now }),
      }
    : { success: false, error: result.code };
}
