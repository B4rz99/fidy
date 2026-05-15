import { and, eq, isNull } from "drizzle-orm";
import {
  recordTransaction,
  type LocalLedgerEntryId,
  type RecordTransactionAccepted,
  type RecordTransactionCommand,
  type RecordTransactionRejectCode,
} from "@/local-ledger/public";
import { getBuiltInCategoryId, isValidCategoryId } from "@/shared/categories";
import type { AnyDb } from "@/shared/db";
import { financialAccounts, transactions, userCategories } from "@/shared/db/schema";
import { parseDigitsToAmount, toIsoDate, toIsoDateTime } from "@/shared/lib";
import { requireIsoDate } from "@/shared/types/assertions";
import type {
  CategoryId,
  FinancialAccountId,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import { toTransactionStorageRow } from "./transaction-storage";

type ManualTransactionInput = {
  readonly type: "expense" | "income";
  readonly digits: string;
  readonly categoryId: CategoryId | null;
  readonly accountId: FinancialAccountId | null;
  readonly description: string;
  readonly date: Date;
};

type RecordManualTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly transactionId: TransactionId;
  readonly input: ManualTransactionInput;
  readonly now: Date;
};

type RecordAutomatedTransactionInput = {
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

function toLocalLedgerEntryId(transactionId: TransactionId): LocalLedgerEntryId {
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
  | "futureDatedTransaction"
  | "missingAccount"
  | "missingCategory"
  | "manualSourceRequiresResolvedAccount";

export type RecordAutomatedTransactionResult =
  | { readonly success: true; readonly transaction: RecordTransactionAccepted }
  | { readonly success: false; readonly error: RecordTransactionRejectCode };

const rejectionErrorMap: Record<RecordTransactionRejectCode, RecordManualTransactionError> = {
  "account-not-usable": "accountNotUsable",
  "category-not-usable": "categoryNotUsable",
  "future-dated-transaction": "futureDatedTransaction",
  "manual-source-requires-resolved-account": "manualSourceRequiresResolvedAccount",
  "missing-account": "missingAccount",
  "missing-category": "missingCategory",
  "non-positive-amount": "amountNotPositive",
};

function hasActiveFinancialAccount(db: AnyDb, userId: UserId, accountId: FinancialAccountId) {
  const rows = db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.userId, userId),
        isNull(financialAccounts.deletedAt)
      )
    )
    .limit(1)
    .all();
  return rows.length > 0;
}

function hasUsableCategory(db: AnyDb, userId: UserId, categoryId: CategoryId) {
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

function getCommitPolicyRejection(
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
  const categoryId = input.categoryId ?? getBuiltInCategoryId("other");
  const result = await recordTransaction({
    command: {
      userId,
      type: input.type,
      amount: parseDigitsToAmount(input.digits),
      accountId: input.accountId,
      accountAttributionState: "confirmed",
      categoryId,
      occurredOn: toIsoDate(input.date),
      description: input.description,
      counterpartyName: null,
      source: "manual",
    },
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
  const result = await recordTransaction({
    command: { ...command, source: "automated" },
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

  return result.ok
    ? { success: true, transaction: result.transaction }
    : { success: false, error: result.code };
}
