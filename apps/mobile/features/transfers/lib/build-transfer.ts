import { parseIsoDate, toIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import { parseDigitsToAmount } from "@/shared/lib/format-money";
import type { CopAmount, FinancialAccountId, TransferId, UserId } from "@/shared/types/branded";
import type { TransferRow } from "./repository";

export const OUTSIDE_FIDY_LABEL = "Outside Fidy";

export type TransferSide =
  | {
      readonly kind: "account";
      readonly accountId: FinancialAccountId;
    }
  | {
      readonly kind: "external";
      readonly label: string;
    };

export type StoredTransfer = {
  readonly id: TransferId;
  readonly userId: UserId;
  readonly amount: CopAmount;
  readonly fromSide: TransferSide;
  readonly toSide: TransferSide;
  readonly description: string;
  readonly date: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};

type BuildTransferInput = {
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly toSide: TransferSide | null;
  readonly description: string;
  readonly date: Date;
};

export type TransferBuildError =
  | "amountRequired"
  | "fromSideRequired"
  | "toSideRequired"
  | "trackedAccountRequired"
  | "distinctSidesRequired";

const trimLabel = (side: TransferSide): TransferSide =>
  side.kind === "external"
    ? { kind: "external", label: side.label.trim() || OUTSIDE_FIDY_LABEL }
    : side;

const isAccountSide = (side: TransferSide): side is Extract<TransferSide, { kind: "account" }> =>
  side.kind === "account";

const hasTrackedAccount = (fromSide: TransferSide, toSide: TransferSide): boolean =>
  isAccountSide(fromSide) || isAccountSide(toSide);

const hasDistinctSides = (fromSide: TransferSide, toSide: TransferSide): boolean =>
  !(isAccountSide(fromSide) && isAccountSide(toSide) && fromSide.accountId === toSide.accountId);

export function buildTransfer(
  input: BuildTransferInput,
  userId: UserId,
  id: TransferId,
  now: Date,
  existing: StoredTransfer | null = null
): { success: true; transfer: StoredTransfer } | { success: false; error: TransferBuildError } {
  const amount = parseDigitsToAmount(input.digits);

  if (amount <= 0) {
    return { success: false, error: "amountRequired" };
  }

  if (input.fromSide == null) {
    return { success: false, error: "fromSideRequired" };
  }

  if (input.toSide == null) {
    return { success: false, error: "toSideRequired" };
  }

  const fromSide = trimLabel(input.fromSide);
  const toSide = trimLabel(input.toSide);

  if (!hasTrackedAccount(fromSide, toSide)) {
    return { success: false, error: "trackedAccountRequired" };
  }

  if (!hasDistinctSides(fromSide, toSide)) {
    return { success: false, error: "distinctSidesRequired" };
  }

  return {
    success: true,
    transfer: {
      id,
      userId,
      amount: amount as CopAmount,
      fromSide,
      toSide,
      description: input.description.trim(),
      date: input.date,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: existing?.deletedAt ?? null,
    },
  };
}

export function toStoredTransfer(row: TransferRow): StoredTransfer {
  return {
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    fromSide:
      row.fromAccountId != null
        ? { kind: "account", accountId: row.fromAccountId }
        : { kind: "external", label: row.fromExternalLabel ?? OUTSIDE_FIDY_LABEL },
    toSide:
      row.toAccountId != null
        ? { kind: "account", accountId: row.toAccountId }
        : { kind: "external", label: row.toExternalLabel ?? OUTSIDE_FIDY_LABEL },
    description: row.description ?? "",
    date: parseIsoDate(row.date),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
  };
}

export function toTransferRow(transfer: StoredTransfer): TransferRow {
  return {
    id: transfer.id,
    userId: transfer.userId,
    amount: transfer.amount,
    fromAccountId: transfer.fromSide.kind === "account" ? transfer.fromSide.accountId : null,
    toAccountId: transfer.toSide.kind === "account" ? transfer.toSide.accountId : null,
    fromExternalLabel: transfer.fromSide.kind === "external" ? transfer.fromSide.label : null,
    toExternalLabel: transfer.toSide.kind === "external" ? transfer.toSide.label : null,
    description: transfer.description || null,
    date: toIsoDate(transfer.date),
    createdAt: toIsoDateTime(transfer.createdAt),
    updatedAt: toIsoDateTime(transfer.updatedAt),
    deletedAt: transfer.deletedAt ? toIsoDateTime(transfer.deletedAt) : null,
  };
}
