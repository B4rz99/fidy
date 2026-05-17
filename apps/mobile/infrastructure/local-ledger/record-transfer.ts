import {
  createRecordTransfer,
  type LocalLedgerTransfer,
  type RecordTransferRejectionReason,
} from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { transfers } from "@/shared/db/schema";
import { toIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import { parseDigitsToAmount } from "@/shared/lib/format-money";
import type { TransferId, UserId } from "@/shared/types/branded";
import { hasActiveFinancialAccount } from "./account-policy.ts";

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
  "command-user-mismatch": "accountNotUsable",
  "external-label-required": "externalLabelRequired",
  "from-side-required": "fromSideRequired",
  "future-dated": "futureDated",
  "same-account": "distinctSidesRequired",
  "to-side-required": "toSideRequired",
  "tracked-account-required": "trackedAccountRequired",
};

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
    source: transfer.source,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    voidedAt: transfer.voidedAt,
  };
}

export function upsertTransferStorageRow(db: AnyDb, row: typeof transfers.$inferInsert) {
  db.insert(transfers)
    .values(row)
    .onConflictDoUpdate({
      target: transfers.id,
      set: {
        userId: row.userId,
        amount: row.amount,
        fromAccountId: row.fromAccountId,
        toAccountId: row.toAccountId,
        fromExternalLabel: row.fromExternalLabel,
        toExternalLabel: row.toExternalLabel,
        description: row.description,
        date: row.date,
        source: row.source,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        voidedAt: row.voidedAt,
      },
    })
    .run();
}

export function saveTransferStorageRow(db: AnyDb, row: typeof transfers.$inferInsert) {
  upsertTransferStorageRow(db, row);
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
    userId,
    transferId,
    amount,
    fromSide: input.fromSide,
    toSide: input.toSide,
    description: normalizedDescription,
    date: toIsoDate(input.date),
    source: "manual",
    now: toIsoDateTime(now),
  });

  return result.code === "recorded"
    ? { success: true, transfer: result.transfer }
    : { success: false, error: rejectionErrorMap[result.reason] };
}
