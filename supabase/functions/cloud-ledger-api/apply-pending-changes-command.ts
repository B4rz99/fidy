import {
  CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT,
  type CloudLedgerApplyPendingChangesCommand,
  type CloudLedgerExpectedRecordVersion,
} from "./model.ts";
import { readCreateTransactionCommand } from "./create-transaction-command.ts";

export type ApplyPendingChangesCommandReadResult =
  | { readonly kind: "valid"; readonly command: CloudLedgerApplyPendingChangesCommand }
  | { readonly kind: "invalid_pending_change" }
  | { readonly kind: "invalid_transaction_id" }
  | { readonly kind: "invalid_ledger_reference" }
  | { readonly kind: "invalid_transaction" }
  | { readonly kind: "pending_change_batch_too_large" }
  | { readonly kind: "unsupported_command_version" };
type ValidPendingChangeReadResult = {
  readonly kind: "valid";
  readonly change: CloudLedgerApplyPendingChangesCommand["changes"][number];
};
type PendingChangeReadResult =
  | ValidPendingChangeReadResult
  | Exclude<ApplyPendingChangesCommandReadResult, { readonly kind: "valid" }>;

const LEDGER_CHANGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const ISO_CLIENT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

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
  const deviceId = readEnvelopeId(record.deviceId);
  const batchId = readEnvelopeId(record.batchId);
  if (deviceId === null || batchId === null) {
    return { kind: "invalid_pending_change" };
  }
  if (record.changes.length > CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT) {
    return { kind: "pending_change_batch_too_large" };
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
      deviceId,
      batchId,
      changes: changes.filter(isValidPendingChange).map((change) => change.change),
    },
  };
}

function readPendingChange(value: unknown): PendingChangeReadResult {
  if (value === null || typeof value !== "object") {
    return { kind: "invalid_pending_change" } as const;
  }
  const record = value as Record<string, unknown>;
  if (!isLedgerChangeId(record.id)) {
    return { kind: "invalid_pending_change" } as const;
  }
  const pendingChangeKind = readPendingChangeKind(record.kind);
  const commandVersion = readCommandVersion(record.commandVersion);
  const idempotencyKey = readLedgerChangeIdentity(record.idempotencyKey);
  const dependencies = readLedgerChangeDependencies(record.dependencies);
  const expectedVersions = readExpectedVersions(record.expectedVersions);
  const clientTimestamp = readClientTimestamp(record.clientTimestamp);
  if (
    pendingChangeKind === null ||
    commandVersion === null ||
    idempotencyKey === null ||
    dependencies === null ||
    expectedVersions === null ||
    clientTimestamp === null
  ) {
    return { kind: "invalid_pending_change" } as const;
  }
  if (commandVersion !== 1) {
    return {
      kind: "valid",
      change: {
        id: record.id,
        kind: pendingChangeKind,
        commandVersion,
        idempotencyKey,
        dependencies,
        expectedVersions,
        clientTimestamp,
        ...("transaction" in record ? { transaction: record.transaction } : {}),
      },
    } as const;
  }
  if (pendingChangeKind !== "createTransaction") {
    return { kind: "invalid_pending_change" } as const;
  }
  const commandResult = readCreateTransactionCommand({
    commandVersion,
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
      idempotencyKey,
      dependencies,
      expectedVersions,
      clientTimestamp,
      transaction: commandResult.command.transaction,
    },
  } as const;
}

function readEnvelopeId(value: unknown): string | null {
  return typeof value === "string" && isLedgerChangeId(value) ? value : null;
}

function readPendingChangeKind(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readCommandVersion(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readLedgerChangeIdentity(value: unknown): string | null {
  return typeof value === "string" && isLedgerChangeId(value) ? value : null;
}

function readLedgerChangeDependencies(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.every(isLedgerChangeId) ? value : null;
}

function readExpectedVersions(value: unknown): readonly CloudLedgerExpectedRecordVersion[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const versions = value.map(readExpectedVersion);
  return versions.every(isExpectedVersion) ? versions : null;
}

function readExpectedVersion(value: unknown): CloudLedgerExpectedRecordVersion | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.recordType !== "transaction" ||
    typeof record.recordId !== "string" ||
    record.recordId.trim().length === 0 ||
    typeof record.version !== "number" ||
    !Number.isInteger(record.version) ||
    record.version <= 0
  ) {
    return null;
  }
  return {
    recordType: "transaction",
    recordId: record.recordId,
    version: record.version,
  };
}

function readClientTimestamp(value: unknown): string | null {
  return typeof value === "string" && ISO_CLIENT_TIMESTAMP_PATTERN.test(value) ? value : null;
}

function isLedgerChangeId(value: unknown): value is string {
  return typeof value === "string" && LEDGER_CHANGE_ID_PATTERN.test(value);
}

function isExpectedVersion(
  value: CloudLedgerExpectedRecordVersion | null
): value is CloudLedgerExpectedRecordVersion {
  return value !== null;
}

function isValidPendingChange(
  result: PendingChangeReadResult
): result is ValidPendingChangeReadResult {
  return result.kind === "valid";
}
