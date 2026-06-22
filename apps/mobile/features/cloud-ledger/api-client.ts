import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerCursor,
  requireTransactionId,
} from "@/shared/types/assertions";
import type { CategoryId, LedgerCursor } from "@/shared/types/branded";
import type {
  CloudLedgerBootstrapPayload,
  CloudLedgerCategory,
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

type CloudLedgerApiResponse =
  | { readonly success: true; readonly data: CloudLedgerWirePayload }
  | { readonly success: false; readonly error: CloudLedgerApiErrorCode };

type RemoteErrorLike = {
  readonly message?: string;
};

const AUTHORIZATION_HEADER = "Authorization";
const CLOUD_LEDGER_FUNCTION = "cloud-ledger-api";
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
  const response = await supabase.functions.invoke<CloudLedgerApiResponse>(CLOUD_LEDGER_FUNCTION, {
    body: cursor === null ? { action: "bootstrap" } : { action: "refresh", cursor },
    ...(await authorizationHeaders(supabase)),
  });

  if (response.data !== null && !response.data.success) {
    throw new CloudLedgerClientFailure(
      response.data.error,
      `Cloud Ledger API failed: ${response.data.error}`
    );
  }
  throwIfTransportError(response.error);
  if (response.data === null) {
    throw new CloudLedgerClientFailure("missing_response", "Cloud Ledger API returned no response");
  }

  return parseCloudLedgerPayload(response.data.data);
}

async function authorizationHeaders(supabase: SupabaseClient) {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;
  return accessToken ? { headers: { [AUTHORIZATION_HEADER]: `Bearer ${accessToken}` } } : {};
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
  return trimmed;
}

function throwIfTransportError(error: RemoteErrorLike | null) {
  if (error !== null) {
    throw new CloudLedgerClientFailure(
      "transport_error",
      `Unable to call Cloud Ledger API: ${error.message ?? "unknown error"}`
    );
  }
}

function parseTombstone(row: CloudLedgerWireTombstone): CloudLedgerTombstone {
  return {
    recordType: requireTombstoneRecordType(row.recordType),
    recordId: requireNonEmptyRecordId(row.recordId),
    deletedAt: requireIsoDateTime(row.deletedAt),
  };
}
