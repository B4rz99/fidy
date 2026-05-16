import { and, eq, isNull } from "drizzle-orm";
import {
  createRecordTransfer,
  type LocalLedgerTransfer,
  type RecordTransferRejectionReason,
} from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { financialAccounts, transfers } from "@/shared/db/schema";
import { toIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import { parseDigitsToAmount } from "@/shared/lib/format-money";
import type { CopAmount, FinancialAccountId, TransferId, UserId } from "@/shared/types/branded";

type ManualTransferInput = {
  readonly digits: string;
  readonly fromSide: LocalLedgerTransfer["fromSide"] | null;
  readonly toSide: LocalLedgerTransfer["toSide"] | null;
  readonly description: string;
  readonly date: Date;
};

type RecordManualTransferInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly transferId: TransferId;
  readonly input: ManualTransferInput;
  readonly now: Date;
};

type RecordManualTransferResult =
  | { readonly success: true; readonly transfer: LocalLedgerTransfer }
  | {
      readonly success: false;
      readonly error: RecordManualTransferError;
    };

type RecordManualTransferError =
  | "accountNotUsable"
  | "amountNotPositive"
  | "distinctSidesRequired"
  | "externalLabelRequired"
  | "fromSideRequired"
  | "futureDated"
  | "toSideRequired"
  | "trackedAccountRequired";

const rejectionErrorMap: Record<RecordTransferRejectionReason, RecordManualTransferError> = {
  "account-not-usable": "accountNotUsable",
  "amount-not-positive": "amountNotPositive",
  "external-label-required": "externalLabelRequired",
  "from-side-required": "fromSideRequired",
  "future-dated": "futureDated",
  "same-account": "distinctSidesRequired",
  "to-side-required": "toSideRequired",
  "tracked-account-required": "trackedAccountRequired",
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

export function toTransferRow(transfer: LocalLedgerTransfer): typeof transfers.$inferInsert {
  return {
    id: transfer.id,
    userId: transfer.userId,
    amount: transfer.amount,
    fromAccountId: transfer.fromSide.kind === "account" ? transfer.fromSide.accountId : null,
    toAccountId: transfer.toSide.kind === "account" ? transfer.toSide.accountId : null,
    fromExternalLabel: transfer.fromSide.kind === "external" ? transfer.fromSide.label : null,
    toExternalLabel: transfer.toSide.kind === "external" ? transfer.toSide.label : null,
    description: transfer.description || null,
    date: transfer.date,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    deletedAt: transfer.voidedAt,
  };
}

function insertTransfer(db: AnyDb, transfer: LocalLedgerTransfer) {
  const row = toTransferRow(transfer);
  db.insert(transfers).values(row).run();
}

export async function recordManualTransferWithLocalLedger({
  db,
  userId,
  transferId,
  input,
  now,
}: RecordManualTransferInput): Promise<RecordManualTransferResult> {
  const normalizedDescription = input.description.trim();
  const amount = parseDigitsToAmount(input.digits);

  const recordTransfer = createRecordTransfer({
    transfers: {
      record: async (transfer) => {
        return db.transaction((tx) => {
          const accountSides = [transfer.fromSide, transfer.toSide].filter(
            (side): side is Extract<LocalLedgerTransfer["fromSide"], { kind: "account" }> =>
              side.kind === "account"
          );
          const canUseAccounts = accountSides.every((side) =>
            hasActiveFinancialAccount(tx, userId, side.accountId)
          );
          if (!canUseAccounts) return { code: "account-not-usable" };

          insertTransfer(tx, transfer);
          return { code: "recorded", transfer };
        });
      },
    },
    today: () => toIsoDate(now),
    userId,
  });

  const result = await recordTransfer({
    transferId,
    amount: amount as CopAmount,
    fromSide: input.fromSide,
    toSide: input.toSide,
    description: normalizedDescription,
    date: toIsoDate(input.date),
    now: toIsoDateTime(now),
  });

  return result.code === "recorded"
    ? { success: true, transfer: result.transfer }
    : { success: false, error: rejectionErrorMap[result.reason] };
}
