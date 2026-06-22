import type { CloudLedgerApplyPendingChangesCommand } from "./model.ts";
import { readCreateTransactionCommand } from "./create-transaction-command.ts";

export type ApplyPendingChangesCommandReadResult =
  | { readonly kind: "valid"; readonly command: CloudLedgerApplyPendingChangesCommand }
  | { readonly kind: "invalid_pending_change" }
  | { readonly kind: "invalid_transaction_id" }
  | { readonly kind: "invalid_ledger_reference" }
  | { readonly kind: "invalid_transaction" }
  | { readonly kind: "unsupported_command_version" };
type ValidPendingChangeReadResult = {
  readonly kind: "valid";
  readonly change: CloudLedgerApplyPendingChangesCommand["changes"][number];
};
type PendingChangeReadResult =
  | ValidPendingChangeReadResult
  | Exclude<ApplyPendingChangesCommandReadResult, { readonly kind: "valid" }>;

const LEDGER_CHANGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function readApplyPendingChangesCommand(
  body: unknown
): ApplyPendingChangesCommandReadResult {
  if (body === null || typeof body !== "object") {
    return { kind: "invalid_pending_change" };
  }
  const record = body as Record<string, unknown>;
  if (record.commandVersion !== 1 || !Array.isArray(record.changes)) {
    return { kind: "unsupported_command_version" };
  }

  const changes = record.changes.map(readPendingChange);
  const invalid = changes.find((change) => change.kind !== "valid");
  if (invalid !== undefined) {
    return invalid;
  }

  return {
    kind: "valid",
    command: {
      commandVersion: 1,
      changes: changes.filter(isValidPendingChange).map((change) => change.change),
    },
  };
}

function readPendingChange(value: unknown): PendingChangeReadResult {
  if (value === null || typeof value !== "object") {
    return { kind: "invalid_pending_change" } as const;
  }
  const record = value as Record<string, unknown>;
  if (record.kind !== "createTransaction" || !isLedgerChangeId(record.id)) {
    return { kind: "invalid_pending_change" } as const;
  }
  const commandResult = readCreateTransactionCommand({
    commandVersion: record.commandVersion,
    transaction: record.transaction,
  });
  if (commandResult.kind !== "valid") {
    return commandResult;
  }
  return {
    kind: "valid",
    change: {
      id: record.id,
      kind: "createTransaction",
      commandVersion: 1,
      transaction: commandResult.command.transaction,
    },
  } as const;
}

function isLedgerChangeId(value: unknown): value is string {
  return typeof value === "string" && LEDGER_CHANGE_ID_PATTERN.test(value);
}

function isValidPendingChange(
  result: PendingChangeReadResult
): result is ValidPendingChangeReadResult {
  return result.kind === "valid";
}
