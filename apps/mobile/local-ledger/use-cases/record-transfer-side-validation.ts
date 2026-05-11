import type { LocalLedgerTransferSide } from "../domain/public";
import type { RejectedRecordTransferCommand } from "./record-transfer-result";
import { reject } from "./record-transfer-result";
import type { ValidRecordTransferCommand } from "./record-transfer-validation";

type AcceptedRecordTransferCommand = {
  readonly code: "accepted";
  readonly command: ValidRecordTransferCommand;
};

export function validateTransferSides(
  command: ValidRecordTransferCommand
): AcceptedRecordTransferCommand | RejectedRecordTransferCommand {
  if (hasBlankExternalLabel(command.fromSide) || hasBlankExternalLabel(command.toSide)) {
    return reject("external-label-required");
  }
  if (command.fromSide.kind === "external" && command.toSide.kind === "external") {
    return reject("tracked-account-required");
  }
  if (usesSameAccount(command.fromSide, command.toSide)) return reject("same-account");
  return { code: "accepted", command };
}

function usesSameAccount(fromSide: LocalLedgerTransferSide, toSide: LocalLedgerTransferSide) {
  return (
    fromSide.kind === "account" &&
    toSide.kind === "account" &&
    fromSide.accountId === toSide.accountId
  );
}

function hasBlankExternalLabel(side: LocalLedgerTransferSide) {
  return side.kind === "external" && side.label.trim().length === 0;
}
