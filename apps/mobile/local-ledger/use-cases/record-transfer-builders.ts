import type { IsoDateTime } from "@/shared/types/branded";
import type { LocalLedgerDomainEvent, LocalLedgerTransfer, UserId } from "../domain/public";
import type { ValidRecordTransferCommand } from "./record-transfer-validation";

export function toLocalLedgerTransfer(
  command: ValidRecordTransferCommand,
  userId: UserId
): LocalLedgerTransfer {
  return {
    id: command.transferId,
    userId,
    amount: command.amount,
    fromSide: command.fromSide,
    toSide: command.toSide,
    description: command.description,
    date: command.date,
    createdAt: command.now,
    updatedAt: command.now,
    voidedAt: null,
  };
}

export function transferRecordedEvent(
  transfer: LocalLedgerTransfer,
  occurredAt: IsoDateTime
): LocalLedgerDomainEvent {
  return {
    type: "local-ledger.transfer-recorded",
    transferId: transfer.id,
    userId: transfer.userId,
    occurredAt,
  };
}
