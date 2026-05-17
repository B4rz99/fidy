import { and, eq, isNull } from "drizzle-orm";
import {
  createAmendTransactionUseCase,
  createRecordTransactionUseCase,
  createVoidTransactionUseCase,
  type AmendableTransaction,
} from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { transactions } from "@/shared/db/schema";
import { toIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import { parseDigitsToAmount } from "@/shared/lib/format-money";
import type { IsoDateTime, TransactionId, UserId } from "@/shared/types/branded";
import { hasActiveFinancialAccount } from "./account-policy.ts";
import {
  getCommitPolicyRejection,
  hasUsableCategory,
  rejectionErrorMap,
  toLocalLedgerEntryId,
  type RecordManualTransactionInput,
  type RecordManualTransactionResult,
} from "./record-transaction";
import { toTransactionStorageRow } from "./transaction-storage";

type AmendManualTransactionInput = RecordManualTransactionInput;

type VoidTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly transactionId: TransactionId;
  readonly now: Date | IsoDateTime;
};

export type AmendManualTransactionResult = RecordManualTransactionResult;
export type VoidTransactionResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: "transactionNotFound" };

const toVoidTransactionResult = (changes: number): VoidTransactionResult =>
  changes === 1 ? { success: true } : { success: false, error: "transactionNotFound" };

const activeTransactionForUser = (input: {
  readonly userId: UserId;
  readonly transactionId: TransactionId;
}) =>
  and(
    eq(transactions.id, input.transactionId),
    eq(transactions.userId, input.userId),
    isNull(transactions.voidedAt)
  );

const isAccountAttributionState = (
  value: string | null
): value is "confirmed" | "inferred" | "unresolved" =>
  value === "confirmed" || value === "inferred" || value === "unresolved";

const isStoredTransactionSource = (
  value: string | null
): value is "email_capture" | "notification_capture" | "widget_capture" | "apple_pay_capture" =>
  value === "email_capture" ||
  value === "notification_capture" ||
  value === "widget_capture" ||
  value === "apple_pay_capture";

const toAmendableTransaction = (row: typeof transactions.$inferSelect): AmendableTransaction => ({
  id: toLocalLedgerEntryId(row.id),
  userId: row.userId,
  accountAttributionState: isAccountAttributionState(row.accountAttributionState)
    ? row.accountAttributionState
    : "confirmed",
  counterpartyName: row.counterpartyName ?? null,
  source: isStoredTransactionSource(row.source) ? row.source : "manual",
});

export async function amendManualTransactionWithLocalLedger({
  db,
  userId,
  transactionId,
  input,
  now,
}: AmendManualTransactionInput): Promise<AmendManualTransactionResult> {
  const nowIso = toIsoDateTime(now);
  const existing = db
    .select()
    .from(transactions)
    .where(activeTransactionForUser({ userId, transactionId }))
    .limit(1)
    .all()[0];
  const existingOrThrow = () => {
    if (existing === undefined) {
      throw new Error("transaction-not-found");
    }
    return existing;
  };
  const recordTransaction = createRecordTransactionUseCase({
    ports: {
      canUseAccount: async ({ accountId }) => hasActiveFinancialAccount(db, userId, accountId),
      canUseCategory: async ({ categoryId }) => hasUsableCategory(db, userId, categoryId),
      commit: async (transaction) =>
        db.transaction((tx) => {
          const policyRejection = getCommitPolicyRejection(tx, transaction);
          if (policyRejection) return policyRejection;

          const row = {
            ...toTransactionStorageRow({ transaction, now: nowIso }),
            createdAt: existingOrThrow().createdAt,
            supersededAt: existingOrThrow().supersededAt ?? null,
            supersededByTransferId: existingOrThrow().supersededByTransferId ?? null,
          };
          tx.update(transactions)
            .set(row)
            .where(
              and(
                eq(transactions.id, transactionId),
                eq(transactions.userId, userId),
                isNull(transactions.voidedAt)
              )
            )
            .run();
          return { ok: true, transaction };
        }),
      generateEntryId: () => toLocalLedgerEntryId(transactionId),
      today: () => toIsoDate(now),
    },
  });
  const amendTransaction = createAmendTransactionUseCase({
    loadAmendableTransaction: async () =>
      existing === undefined ? null : toAmendableTransaction(existing),
    recordTransaction,
  });

  const result = await amendTransaction({
    userId,
    transactionId: toLocalLedgerEntryId(transactionId),
    type: input.type,
    amount: parseDigitsToAmount(input.digits),
    accountId: input.accountId,
    categoryId: input.categoryId,
    occurredOn: toIsoDate(input.date),
    description: input.description,
  });

  return result.ok
    ? {
        success: true,
        transaction: {
          ...toTransactionStorageRow({ transaction: result.transaction, now: nowIso }),
          createdAt: existingOrThrow().createdAt,
          supersededAt: existingOrThrow().supersededAt ?? null,
          supersededByTransferId: existingOrThrow().supersededByTransferId ?? null,
        },
      }
    : {
        success: false,
        error:
          result.code === "transaction-not-found"
            ? "missingAccount"
            : rejectionErrorMap[result.code],
      };
}

export function voidTransactionWithLocalLedger(input: VoidTransactionInput): VoidTransactionResult {
  const nowIso = typeof input.now === "string" ? input.now : toIsoDateTime(input.now);
  const voidTransaction = createVoidTransactionUseCase({
    canVoidTransaction: (command) => {
      const existing = input.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          activeTransactionForUser({
            userId: command.userId,
            transactionId: input.transactionId,
          })
        )
        .limit(1)
        .all()[0];
      return existing !== undefined;
    },
    commitVoidTransaction: (command) => {
      const result = input.db
        .update(transactions)
        .set({ voidedAt: command.now, updatedAt: command.now })
        .where(
          activeTransactionForUser({
            userId: command.userId,
            transactionId: input.transactionId,
          })
        )
        .run();
      return result.changes === 1;
    },
  });
  const result = voidTransaction({
    userId: input.userId,
    transactionId: toLocalLedgerEntryId(input.transactionId),
    now: nowIso,
  });
  return result.ok ? { success: true } : toVoidTransactionResult(0);
}
