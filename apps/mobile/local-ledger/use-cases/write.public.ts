import type { CopAmount, IsoDate, IsoDateTime } from "@/shared/types/branded";
import type {
  LocalLedgerCommandId,
  LocalLedgerDomainEvent,
  LocalLedgerEntry,
  LocalLedgerTransfer,
  LocalLedgerTransferSide,
  TransferId,
  UserId,
} from "../domain/public";
import type { LocalLedgerTransferRepository } from "../ports/public";
import { toLocalLedgerTransfer, transferRecordedEvent } from "./record-transfer-builders";
import { reject } from "./record-transfer-result";
import {
  validateRecordTransfer,
  type ValidRecordTransferCommand,
} from "./record-transfer-validation";

export type WriteLocalLedgerEntryCommand = {
  readonly commandId: LocalLedgerCommandId;
  readonly entry: LocalLedgerEntry;
};

export type WriteLocalLedgerEntry = (
  command: WriteLocalLedgerEntryCommand
) => Promise<LocalLedgerEntry>;

export type RecordTransferCommand = {
  readonly transferId: TransferId;
  readonly amount: CopAmount;
  readonly fromSide: LocalLedgerTransferSide | null;
  readonly toSide: LocalLedgerTransferSide | null;
  readonly description: string;
  readonly date: IsoDate;
  readonly now: IsoDateTime;
};

export type RecordTransferResult =
  | {
      readonly code: "recorded";
      readonly transfer: LocalLedgerTransfer;
      readonly events: readonly LocalLedgerDomainEvent[];
    }
  | {
      readonly code: "rejected";
      readonly reason: RecordTransferRejectionReason;
      readonly events: readonly [];
    };

export type RecordTransferRejectionReason =
  | "future-dated"
  | "amount-not-positive"
  | "from-side-required"
  | "to-side-required"
  | "tracked-account-required"
  | "same-account"
  | "account-not-usable"
  | "external-label-required";

export type RecordTransfer = (command: RecordTransferCommand) => Promise<RecordTransferResult>;

export type RecordTransferDependencies = {
  readonly transfers: LocalLedgerTransferRepository;
  readonly today: () => IsoDate;
  readonly userId: UserId;
};

export function createRecordTransfer(dependencies: RecordTransferDependencies): RecordTransfer {
  return async (command) => {
    const validated = await validateRecordTransfer(command, dependencies);
    if (validated.code === "rejected") return validated;

    return recordValidatedTransfer(validated.command, dependencies);
  };
}

async function recordValidatedTransfer(
  command: ValidRecordTransferCommand,
  dependencies: RecordTransferDependencies
): Promise<RecordTransferResult> {
  const transfer = toLocalLedgerTransfer(command, dependencies.userId);
  const recordResult = await dependencies.transfers.record(transfer);
  if (recordResult.code === "account-not-usable") return reject("account-not-usable");

  return {
    code: "recorded",
    transfer: recordResult.transfer,
    events: [transferRecordedEvent(recordResult.transfer, command.now)],
  };
}
