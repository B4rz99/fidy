import {
  CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT,
  type CloudLedgerApplyPendingChangesCommand,
  type CloudLedgerExpectedRecordVersion,
} from "./pending-change-set-model.ts";
import {
  readCloudLedgerTransactionId,
  readCreateTransactionCommand,
  type CreateTransactionCommandReadResult,
} from "./create-transaction-command.ts";

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
type InvalidPendingChangeCode =
  | "invalid_ledger_reference"
  | "invalid_transaction"
  | "invalid_transaction_id";
type PendingChangeEnvelope = {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly dependencies: readonly string[];
  readonly expectedVersions: readonly CloudLedgerExpectedRecordVersion[];
  readonly clientTimestamp: string;
};

const LEDGER_CHANGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const ISO_CLIENT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
export function readApplyPendingChangesCommand(
  body: unknown
): ApplyPendingChangesCommandReadResult {
  if (body === null || typeof body !== "object") {
    return { kind: "invalid_pending_change" };
  }
  const record = body as Record<string, unknown>;
  const commandVersion = readCommandVersion(record.commandVersion);
  if (commandVersion === null || !Array.isArray(record.changes)) {
    return { kind: "invalid_pending_change" };
  }
  if (record.changes.length > CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT) {
    return { kind: "pending_change_batch_too_large" };
  }
  if (commandVersion !== 1) {
    const changes = record.changes.map(readUnsupportedEnvelopeChange);
    return changes.every(isUnsupportedEnvelopeChange)
      ? {
          kind: "valid",
          command: {
            commandVersion,
            deviceId: readOptionalEnvelopeId(record.deviceId),
            batchId: readOptionalEnvelopeId(record.batchId),
            changes,
          },
        }
      : { kind: "invalid_pending_change" };
  }
  const deviceId = readEnvelopeId(record.deviceId);
  const batchId = readEnvelopeId(record.batchId);
  if (deviceId === null || batchId === null) {
    return { kind: "invalid_pending_change" };
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

function readUnsupportedEnvelopeChange(value: unknown): { readonly id: string } | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  return isLedgerChangeId(record.id) ? { id: record.id } : null;
}

function readPendingChange(value: unknown): PendingChangeReadResult {
  if (value === null || typeof value !== "object") {
    return { kind: "invalid_pending_change" } as const;
  }
  const record = value as Record<string, unknown>;
  if (!isLedgerChangeId(record.id)) {
    return { kind: "invalid_pending_change" } as const;
  }
  const id = record.id;
  const pendingChangeKind = readPendingChangeKind(record.kind);
  const commandVersion = readCommandVersion(record.commandVersion);
  if (pendingChangeKind === null || commandVersion === null) {
    return { kind: "invalid_pending_change" } as const;
  }
  if (commandVersion !== 1) {
    return toUnsupportedPendingChange(
      readUnsupportedPendingChange(record, id, pendingChangeKind, commandVersion)
    );
  }

  if (pendingChangeKind === "createTransaction") {
    return readCreateTransactionPendingChange(record, id);
  }
  if (pendingChangeKind === "amendTransaction") {
    return readAmendTransactionPendingChange(record, id);
  }
  if (pendingChangeKind === "deleteTransaction") {
    return readDeleteTransactionPendingChange(record, id);
  }
  return toUnsupportedPendingChange(
    readUnsupportedPendingChange(record, id, pendingChangeKind, commandVersion)
  );
}

function readCreateTransactionPendingChange(
  record: Record<string, unknown>,
  id: string
): PendingChangeReadResult {
  const envelope = readStrictPendingChangeEnvelope(record, id);
  if (envelope === null) {
    return { kind: "invalid_pending_change" } as const;
  }
  const commandResult = readCreateTransactionCommand({
    commandVersion: 1,
    transaction: record.transaction,
  });
  if (commandResult.kind !== "valid") {
    return toInvalidPendingChange(commandResult.kind, envelope);
  }
  return {
    kind: "valid",
    change: {
      ...envelope,
      kind: "createTransaction",
      commandVersion: 1,
      transaction: commandResult.command.transaction,
    },
  } as const;
}

function readAmendTransactionPendingChange(
  record: Record<string, unknown>,
  id: string
): PendingChangeReadResult {
  const envelope = readStrictPendingChangeEnvelope(record, id);
  if (envelope === null) {
    return { kind: "invalid_pending_change" } as const;
  }
  const commandResult = readCreateTransactionCommand({
    commandVersion: 1,
    transaction: record.transaction,
  });
  if (commandResult.kind !== "valid") {
    return toInvalidPendingChange(commandResult.kind, envelope);
  }
  return toTransactionMutationChange("amendTransaction", envelope, commandResult);
}

function readDeleteTransactionPendingChange(
  record: Record<string, unknown>,
  id: string
): PendingChangeReadResult {
  const envelope = readStrictPendingChangeEnvelope(record, id);
  if (envelope === null) {
    return { kind: "invalid_pending_change" } as const;
  }
  const transactionId = readCloudLedgerTransactionId(record.transactionId);
  if (transactionId === null) {
    return toInvalidPendingChange("invalid_transaction_id", envelope);
  }
  return {
    kind: "valid",
    change: {
      ...envelope,
      kind: "deleteTransaction",
      commandVersion: 1,
      transactionId,
    },
  } as const;
}

function readStrictPendingChangeEnvelope(
  record: Record<string, unknown>,
  id: string
): PendingChangeEnvelope | null {
  const idempotencyKey = readLedgerChangeIdentity(record.idempotencyKey);
  const dependencies = readLedgerChangeDependencies(record.dependencies);
  const expectedVersions = readExpectedVersions(record.expectedVersions);
  const clientTimestamp = readClientTimestamp(record.clientTimestamp);
  return idempotencyKey === null ||
    dependencies === null ||
    expectedVersions === null ||
    clientTimestamp === null
    ? null
    : {
        id,
        idempotencyKey,
        dependencies,
        expectedVersions,
        clientTimestamp,
      };
}

function toTransactionMutationChange(
  kind: "amendTransaction",
  envelope: PendingChangeEnvelope,
  commandResult: Extract<CreateTransactionCommandReadResult, { readonly kind: "valid" }>
): PendingChangeReadResult {
  return {
    kind: "valid",
    change: {
      ...envelope,
      kind,
      commandVersion: 1,
      transaction: commandResult.command.transaction,
    },
  } as const;
}

function readUnsupportedPendingChange(
  record: Record<string, unknown>,
  id: string,
  kind: string,
  commandVersion: number
): CloudLedgerApplyPendingChangesCommand["changes"][number] {
  const idempotencyKey = readLedgerChangeIdentity(record.idempotencyKey);
  const dependencies = readLedgerChangeDependencies(record.dependencies);
  const expectedVersions = readExpectedVersions(record.expectedVersions);
  const clientTimestamp = readClientTimestamp(record.clientTimestamp);
  return {
    id,
    kind,
    commandVersion,
    ...(idempotencyKey === null ? {} : { idempotencyKey }),
    ...(dependencies === null ? {} : { dependencies }),
    ...(expectedVersions === null ? {} : { expectedVersions }),
    ...(clientTimestamp === null ? {} : { clientTimestamp }),
    ...("transaction" in record ? { transaction: record.transaction } : {}),
  };
}

function toUnsupportedPendingChange(
  change: CloudLedgerApplyPendingChangesCommand["changes"][number]
): PendingChangeReadResult {
  return {
    kind: "valid",
    change,
  };
}

function toInvalidPendingChange(
  invalidCode: InvalidPendingChangeCode | "unsupported_command_version",
  envelope: {
    readonly id: string;
    readonly idempotencyKey: string;
    readonly dependencies: readonly string[];
    readonly expectedVersions: readonly CloudLedgerExpectedRecordVersion[];
    readonly clientTimestamp: string;
  }
): PendingChangeReadResult {
  return invalidCode === "unsupported_command_version"
    ? { kind: "unsupported_command_version" }
    : {
        kind: "valid",
        change: {
          id: envelope.id,
          kind: "invalidPendingChange",
          commandVersion: 1,
          idempotencyKey: envelope.idempotencyKey,
          dependencies: envelope.dependencies,
          expectedVersions: envelope.expectedVersions,
          clientTimestamp: envelope.clientTimestamp,
          invalidCode,
        },
      };
}

function readEnvelopeId(value: unknown): string | null {
  return typeof value === "string" && isLedgerChangeId(value) ? value : null;
}

function readOptionalEnvelopeId(value: unknown): string | null {
  return value === undefined ? null : readEnvelopeId(value);
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

function isUnsupportedEnvelopeChange(
  value: { readonly id: string } | null
): value is { readonly id: string } {
  return value !== null;
}
