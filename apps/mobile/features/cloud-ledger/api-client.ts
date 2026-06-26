import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerChangeId,
  requireLedgerCursor,
  requireTransactionId,
} from "@/shared/types/assertions";
import type {
  CategoryId,
  LedgerChangeId,
  LedgerCursor,
  TransactionId,
} from "@/shared/types/branded";
import type {
  CloudLedgerBootstrapPayload,
  CloudLedgerCategory,
  CloudLedgerCreateTransactionAccepted,
  CloudLedgerCreateTransactionCommand,
  CloudLedgerFinancialAccount,
  CloudLedgerTombstone,
  CloudLedgerTombstoneRecordType,
  CloudLedgerTransaction,
} from "./cache";

type CloudLedgerApiErrorCode =
  | "missing_auth"
  | "invalid_auth"
  | "method_not_allowed"
  | "unsupported_action"
  | "invalid_cursor"
  | "duplicate_transaction_id"
  | "invalid_ledger_reference"
  | "invalid_transaction"
  | "invalid_transaction_id"
  | "pending_change_batch_too_large"
  | "unauthorized_transaction_id"
  | "unsupported_command_version"
  | "internal_error";

export type CloudLedgerClientFailureCode =
  | CloudLedgerApiErrorCode
  | "transport_error"
  | "missing_response"
  | "invalid_response";

type CloudLedgerWireCategory = {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly color: string | null;
  readonly updatedAt: string;
};

type CloudLedgerWireFinancialAccount = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly currency: string;
  readonly updatedAt: string;
};

type CloudLedgerWireTransaction = {
  readonly id: string;
  readonly type: string;
  readonly amount: number;
  readonly currency: string;
  readonly categoryId: string | null;
  readonly accountId: string;
  readonly description: string | null;
  readonly date: string;
  readonly updatedAt: string;
};

type CloudLedgerWireTombstone = {
  readonly recordType: string;
  readonly recordId: string;
  readonly deletedAt: string;
};

type CloudLedgerWirePayload = {
  readonly cursor: string;
  readonly categories: readonly CloudLedgerWireCategory[];
  readonly financialAccounts: readonly CloudLedgerWireFinancialAccount[];
  readonly transactions: readonly CloudLedgerWireTransaction[];
  readonly tombstones: readonly CloudLedgerWireTombstone[];
};

type CloudLedgerBootstrapApiResponse =
  | { readonly success: true; readonly data: CloudLedgerWirePayload }
  | { readonly success: false; readonly error: CloudLedgerApiErrorCode };

type CloudLedgerWireCreateTransactionAccepted = {
  readonly code: "accepted";
  readonly transaction: CloudLedgerWireTransaction;
  readonly cursor: string;
};

type CloudLedgerWireApplyPendingChangesAccepted = {
  readonly code: "accepted";
  readonly acceptedChangeIds: readonly string[];
  readonly rejectedChangeIds?: readonly string[];
  readonly changeOutcomes?: readonly CloudLedgerWirePendingChangeOutcome[];
  readonly cursor: string;
};

type CloudLedgerWirePendingChangeOutcome = {
  readonly changeId: string;
  readonly status: string;
  readonly code: string;
};

type CloudLedgerCreateTransactionApiResponse =
  | { readonly success: true; readonly data: CloudLedgerWireCreateTransactionAccepted }
  | { readonly success: false; readonly error: CloudLedgerApiErrorCode };

type CloudLedgerApplyPendingChangesApiResponse =
  | { readonly success: true; readonly data: CloudLedgerWireApplyPendingChangesAccepted }
  | { readonly success: false; readonly error: CloudLedgerApiErrorCode };

export type CloudLedgerApplyPendingCreateTransactionChange = {
  readonly id: LedgerChangeId;
  readonly kind: "createTransaction";
  readonly commandVersion: 1;
  readonly idempotencyKey: LedgerChangeId;
  readonly dependencies: readonly LedgerChangeId[];
  readonly expectedVersions: readonly CloudLedgerExpectedRecordVersion[];
  readonly clientTimestamp: string;
  readonly transaction: CloudLedgerCreateTransactionCommand["transaction"];
};

export type CloudLedgerExpectedRecordVersion = {
  readonly recordType: "transaction";
  readonly recordId: TransactionId;
  readonly version: number;
};

export type CloudLedgerPendingChangeOutcome = {
  readonly changeId: LedgerChangeId;
  readonly status: "accepted" | "repair_required" | "requires_app_update" | "retryable";
  readonly code: string;
};

export type CloudLedgerApplyPendingChangesCommand = {
  readonly commandVersion: 1;
  readonly deviceId: string;
  readonly batchId: string;
  readonly changes: readonly CloudLedgerApplyPendingCreateTransactionChange[];
};

export type CloudLedgerApplyPendingChangesAccepted = {
  readonly code: "accepted";
  readonly acceptedChangeIds: readonly LedgerChangeId[];
  readonly rejectedChangeIds: readonly LedgerChangeId[];
  readonly changeOutcomes: readonly CloudLedgerPendingChangeOutcome[];
  readonly cursor: LedgerCursor;
};

type RemoteErrorLike = {
  readonly context?: unknown;
  readonly message?: string;
};

const CLOUD_LEDGER_FUNCTION = "cloud-ledger-api";
export const CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT = 10;
const CLOUD_LEDGER_API_ERROR_CODES = new Set<CloudLedgerApiErrorCode>([
  "missing_auth",
  "invalid_auth",
  "method_not_allowed",
  "unsupported_action",
  "invalid_cursor",
  "duplicate_transaction_id",
  "invalid_ledger_reference",
  "invalid_transaction",
  "invalid_transaction_id",
  "pending_change_batch_too_large",
  "unauthorized_transaction_id",
  "unsupported_command_version",
  "internal_error",
]);
const TRANSACTION_TYPE_BY_VALUE: Partial<Record<string, "income" | "expense">> = {
  expense: "expense",
  income: "income",
};
const TOMBSTONE_RECORD_TYPE_BY_VALUE: Partial<Record<string, CloudLedgerTombstoneRecordType>> = {
  category: "category",
  financialAccount: "financialAccount",
  transaction: "transaction",
};

export class CloudLedgerClientFailure extends Error {
  constructor(
    readonly code: CloudLedgerClientFailureCode,
    message: string
  ) {
    super(message);
    this.name = "CloudLedgerClientFailure";
  }
}

export async function fetchCloudLedgerBootstrap(
  supabase: SupabaseClient,
  cursor: LedgerCursor | null
): Promise<CloudLedgerBootstrapPayload> {
  const response = await supabase.functions.invoke<CloudLedgerBootstrapApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: cursor === null ? { action: "bootstrap" } : { action: "refresh", cursor },
    }
  );

  if (response.data !== null && !response.data.success) {
    throw new CloudLedgerClientFailure(
      response.data.error,
      `Cloud Ledger API failed: ${response.data.error}`
    );
  }
  const httpFailure = await readHttpErrorApiFailure(response.error);
  if (httpFailure !== null) {
    throw new CloudLedgerClientFailure(httpFailure, `Cloud Ledger API failed: ${httpFailure}`);
  }
  throwIfTransportError(response.error);
  if (response.data === null) {
    throw new CloudLedgerClientFailure("missing_response", "Cloud Ledger API returned no response");
  }

  return parseCloudLedgerPayload(response.data.data);
}

export async function createCloudLedgerTransaction(
  supabase: SupabaseClient,
  command: CloudLedgerCreateTransactionCommand
): Promise<CloudLedgerCreateTransactionAccepted> {
  const response = await supabase.functions.invoke<CloudLedgerCreateTransactionApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: {
        action: "createTransaction",
        commandVersion: command.commandVersion,
        transaction: command.transaction,
      },
    }
  );

  if (response.data !== null && !response.data.success) {
    throw new CloudLedgerClientFailure(
      response.data.error,
      `Cloud Ledger API failed: ${response.data.error}`
    );
  }
  const httpFailure = await readHttpErrorApiFailure(response.error);
  if (httpFailure !== null) {
    throw new CloudLedgerClientFailure(httpFailure, `Cloud Ledger API failed: ${httpFailure}`);
  }
  throwIfTransportError(response.error);
  if (response.data === null) {
    throw new CloudLedgerClientFailure("missing_response", "Cloud Ledger API returned no response");
  }

  return parseCreateTransactionAccepted(response.data.data);
}

export async function applyPendingCloudLedgerChanges(
  supabase: SupabaseClient,
  command: CloudLedgerApplyPendingChangesCommand,
  options: { readonly signal?: AbortSignal } = {}
): Promise<CloudLedgerApplyPendingChangesAccepted> {
  const response = await supabase.functions.invoke<CloudLedgerApplyPendingChangesApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: {
        action: "applyPendingChanges",
        commandVersion: command.commandVersion,
        deviceId: command.deviceId,
        batchId: command.batchId,
        changes: command.changes,
      },
      signal: options.signal,
    }
  );

  if (response.data !== null && !response.data.success) {
    throw new CloudLedgerClientFailure(
      response.data.error,
      `Cloud Ledger API failed: ${response.data.error}`
    );
  }
  const httpFailure = await readHttpErrorApiFailure(response.error);
  if (httpFailure !== null) {
    throw new CloudLedgerClientFailure(httpFailure, `Cloud Ledger API failed: ${httpFailure}`);
  }
  throwIfTransportError(response.error);
  if (response.data === null) {
    throw new CloudLedgerClientFailure("missing_response", "Cloud Ledger API returned no response");
  }

  return parseApplyPendingChangesAccepted(response.data.data);
}

function parseCloudLedgerPayload(data: CloudLedgerWirePayload): CloudLedgerBootstrapPayload {
  try {
    return {
      cursor: requireLedgerCursor(data.cursor),
      categories: data.categories.map(parseCategory),
      financialAccounts: data.financialAccounts.map(parseFinancialAccount),
      transactions: data.transactions.map(parseTransaction),
      tombstones: data.tombstones.map(parseTombstone),
    };
  } catch (error) {
    throw new CloudLedgerClientFailure(
      "invalid_response",
      error instanceof Error ? error.message : "Invalid Cloud Ledger response"
    );
  }
}

function parseCreateTransactionAccepted(
  data: CloudLedgerWireCreateTransactionAccepted
): CloudLedgerCreateTransactionAccepted {
  try {
    if (data.code !== "accepted") {
      throw new Error("create transaction outcome must be accepted");
    }
    return {
      code: "accepted",
      transaction: parseTransaction(data.transaction),
      cursor: requireLedgerCursor(data.cursor),
    };
  } catch (error) {
    throw new CloudLedgerClientFailure(
      "invalid_response",
      error instanceof Error ? error.message : "Invalid Cloud Ledger response"
    );
  }
}

function parseApplyPendingChangesAccepted(
  data: CloudLedgerWireApplyPendingChangesAccepted
): CloudLedgerApplyPendingChangesAccepted {
  try {
    if (data.code !== "accepted") {
      throw new Error("apply pending changes outcome must be accepted");
    }
    return {
      code: "accepted",
      acceptedChangeIds: data.acceptedChangeIds.map(requireLedgerChangeId),
      rejectedChangeIds: (data.rejectedChangeIds ?? []).map(requireLedgerChangeId),
      changeOutcomes: (data.changeOutcomes ?? []).map(parsePendingChangeOutcome),
      cursor: requireLedgerCursor(data.cursor),
    };
  } catch (error) {
    throw new CloudLedgerClientFailure(
      "invalid_response",
      error instanceof Error ? error.message : "Invalid Cloud Ledger response"
    );
  }
}

function parsePendingChangeOutcome(
  outcome: CloudLedgerWirePendingChangeOutcome
): CloudLedgerPendingChangeOutcome {
  return {
    changeId: requireLedgerChangeId(outcome.changeId),
    status: requirePendingChangeOutcomeStatus(outcome.status),
    code: outcome.code,
  };
}

function requirePendingChangeOutcomeStatus(
  value: string
): CloudLedgerPendingChangeOutcome["status"] {
  if (
    value === "accepted" ||
    value === "repair_required" ||
    value === "requires_app_update" ||
    value === "retryable"
  ) {
    return value;
  }
  throw new Error("pending change outcome status must be supported");
}

function parseCategory(row: CloudLedgerWireCategory): CloudLedgerCategory {
  return {
    id: requireCategoryId(row.id),
    name: row.name,
    icon: row.icon,
    color: row.color,
    updatedAt: requireIsoDateTime(row.updatedAt),
  };
}

function parseFinancialAccount(row: CloudLedgerWireFinancialAccount): CloudLedgerFinancialAccount {
  return {
    id: requireFinancialAccountId(row.id),
    name: row.name,
    type: row.type,
    currency: requireCopCurrency(row.currency),
    updatedAt: requireIsoDateTime(row.updatedAt),
  };
}

function parseTransaction(row: CloudLedgerWireTransaction): CloudLedgerTransaction {
  return {
    id: requireTransactionId(row.id),
    type: requireTransactionType(row.type),
    amount: requireCopAmount(row.amount),
    currency: requireCopCurrency(row.currency),
    categoryId: readCategoryId(row.categoryId),
    accountId: requireFinancialAccountId(row.accountId),
    description: row.description,
    date: requireIsoDate(row.date),
    updatedAt: requireIsoDateTime(row.updatedAt),
  };
}

function readCategoryId(value: string | null): CategoryId | null {
  return value === null ? null : requireCategoryId(value);
}

function requireCopCurrency(value: string): "COP" {
  if (value !== "COP") {
    throw new Error("currency must be COP");
  }
  return value;
}

function requireTransactionType(value: string): "income" | "expense" {
  const transactionType = TRANSACTION_TYPE_BY_VALUE[value];
  if (transactionType === undefined) {
    throw new Error("transaction type must be income or expense");
  }
  return transactionType;
}

function requireTombstoneRecordType(value: string): CloudLedgerTombstoneRecordType {
  const recordType = TOMBSTONE_RECORD_TYPE_BY_VALUE[value];
  if (recordType === undefined) {
    throw new Error("tombstone record type must be category, financialAccount, or transaction");
  }
  return recordType;
}

function requireNonEmptyRecordId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("tombstone record id must be a non-empty string");
  }
  return value;
}

function throwIfTransportError(error: RemoteErrorLike | null) {
  if (error !== null) {
    throw new CloudLedgerClientFailure(
      "transport_error",
      `Unable to call Cloud Ledger API: ${error.message ?? "unknown error"}`
    );
  }
}

async function readHttpErrorApiFailure(
  error: RemoteErrorLike | null
): Promise<CloudLedgerApiErrorCode | null> {
  if (error?.context === undefined) {
    return null;
  }
  try {
    const body = await readRemoteErrorContext(error.context);
    return isCloudLedgerApiFailure(body) ? body.error : null;
  } catch {
    return null;
  }
}

async function readRemoteErrorContext(context: unknown): Promise<unknown> {
  return hasJsonReader(context) ? await context.json() : context;
}

function hasJsonReader(value: unknown): value is { readonly json: () => Promise<unknown> } {
  return (
    value !== null &&
    typeof value === "object" &&
    "json" in value &&
    typeof (value as { readonly json?: unknown }).json === "function"
  );
}

function isCloudLedgerApiFailure(
  value: unknown
): value is { readonly success: false; readonly error: CloudLedgerApiErrorCode } {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.success === false && isCloudLedgerApiErrorCode(record.error);
}

function isCloudLedgerApiErrorCode(value: unknown): value is CloudLedgerApiErrorCode {
  return (
    typeof value === "string" && CLOUD_LEDGER_API_ERROR_CODES.has(value as CloudLedgerApiErrorCode)
  );
}

function parseTombstone(row: CloudLedgerWireTombstone): CloudLedgerTombstone {
  return {
    recordType: requireTombstoneRecordType(row.recordType),
    recordId: requireNonEmptyRecordId(row.recordId),
    deletedAt: requireIsoDateTime(row.deletedAt),
  };
}
