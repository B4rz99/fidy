import type { CopAmount } from "@/shared/types/branded";
import type { LocalLedgerTransferSide } from "../domain/public";
import type { RecordTransferCommand, RecordTransferDependencies } from "./write.public";
import { reject, type RejectedRecordTransferCommand } from "./record-transfer-result";
import { validateTransferSides } from "./record-transfer-side-validation";

export type ValidRecordTransferCommand = RecordTransferCommand & {
  readonly fromSide: LocalLedgerTransferSide;
  readonly toSide: LocalLedgerTransferSide;
};

type AcceptedRecordTransferCommand = {
  readonly code: "accepted";
  readonly command: ValidRecordTransferCommand;
};

export function validateRecordTransfer(
  command: RecordTransferCommand,
  dependencies: RecordTransferDependencies
): AcceptedRecordTransferCommand | RejectedRecordTransferCommand {
  if (command.date > dependencies.today()) return reject("future-dated");
  if (!isPositiveCopAmount(command.amount)) return reject("amount-not-positive");
  if (command.fromSide == null) return reject("from-side-required");
  if (command.toSide == null) return reject("to-side-required");
  return validateTransferSides({
    ...command,
    fromSide: command.fromSide,
    toSide: command.toSide,
  });
}

function isPositiveCopAmount(amount: CopAmount) {
  return Number.isFinite(amount) && Number.isInteger(amount) && amount > 0;
}
