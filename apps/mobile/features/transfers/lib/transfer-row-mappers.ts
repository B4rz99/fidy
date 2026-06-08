import type { LocalLedgerTransfer } from "@/local-ledger/public";
import { parseIsoDate, toIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import type { StoredTransfer } from "./build-transfer";
import {
  toStoredTransferSide,
  toTransferAccountId,
  toTransferExternalLabel,
} from "./build-transfer-helpers";
import type { TransferRow } from "./repository";

function toStoredTransferSideFromRow(
  accountId: TransferRow["fromAccountId"] | TransferRow["toAccountId"],
  externalLabel: TransferRow["fromExternalLabel"] | TransferRow["toExternalLabel"]
) {
  return toStoredTransferSide(accountId ?? null, externalLabel ?? null);
}

function toStoredTransferDescription(description: TransferRow["description"]): string {
  return description ?? "";
}

function toStoredTransferDeletedAt(voidedAt: TransferRow["voidedAt"]): Date | null {
  return voidedAt ? new Date(voidedAt) : null;
}

export function toStoredTransfer(row: TransferRow): StoredTransfer {
  return {
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    fromSide: toStoredTransferSideFromRow(row.fromAccountId, row.fromExternalLabel),
    toSide: toStoredTransferSideFromRow(row.toAccountId, row.toExternalLabel),
    description: toStoredTransferDescription(row.description),
    date: parseIsoDate(row.date),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: toStoredTransferDeletedAt(row.voidedAt),
    source: row.source,
  };
}

export function toStoredTransferFromLocalLedger(transfer: LocalLedgerTransfer): StoredTransfer {
  return {
    id: transfer.id,
    userId: transfer.userId,
    amount: transfer.amount,
    fromSide: transfer.fromSide,
    toSide: transfer.toSide,
    description: transfer.description,
    date: parseIsoDate(transfer.date),
    createdAt: new Date(transfer.createdAt),
    updatedAt: new Date(transfer.updatedAt),
    deletedAt: transfer.voidedAt == null ? null : new Date(transfer.voidedAt),
    source: transfer.source,
  };
}

export function toTransferRow(transfer: StoredTransfer): TransferRow {
  return {
    id: transfer.id,
    userId: transfer.userId,
    amount: transfer.amount,
    fromAccountId: toTransferAccountId(transfer.fromSide),
    toAccountId: toTransferAccountId(transfer.toSide),
    fromExternalLabel: toTransferExternalLabel(transfer.fromSide),
    toExternalLabel: toTransferExternalLabel(transfer.toSide),
    description: transfer.description || null,
    date: toIsoDate(transfer.date),
    createdAt: toIsoDateTime(transfer.createdAt),
    updatedAt: toIsoDateTime(transfer.updatedAt),
    voidedAt: transfer.deletedAt ? toIsoDateTime(transfer.deletedAt) : null,
    source: transfer.source,
  };
}
