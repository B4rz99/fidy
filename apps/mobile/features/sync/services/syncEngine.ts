// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAccountSuggestionDismissalById,
  upsertAccountSuggestionDismissal,
} from "@/features/account-suggestions/lib/dismissals-repository";
import { getBudgetById } from "@/features/budget/lib/repository";
import {
  getCaptureEvidenceById,
  upsertCaptureEvidence,
} from "@/features/capture-evidence/lib/repository";
import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/lib/default-account";
import {
  getFinancialAccountIdentifierById,
  upsertFinancialAccountIdentifier,
} from "@/features/financial-accounts/lib/identifiers-repository";
import {
  getOpeningBalanceById,
  upsertOpeningBalance,
} from "@/features/financial-accounts/lib/opening-balances-repository";
import {
  getFinancialAccountById,
  upsertFinancialAccount,
} from "@/features/financial-accounts/lib/repository";
import { getContributionById, getGoalById } from "@/features/goals/lib/repository";
import {
  clearSyncEntries,
  getQueuedSyncEntries,
  getSyncMeta,
  getTransactionById,
  setSyncMeta,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import { getTransferById, upsertTransfer } from "@/features/transfers/lib/repository";
import type { AnyDb } from "@/shared/db";
import {
  captureError,
  capturePipelineEvent,
  captureWarning,
  generateSyncConflictId,
  toIsoDateTime,
} from "@/shared/lib";
import { requireBudgetId, requireTransactionId } from "@/shared/types/assertions";
import type { SyncQueueId } from "@/shared/types/branded";
import { hasDataConflict } from "../lib/conflict-detection";
import { insertConflict } from "../lib/conflict-repository";

const LEGACY_LAST_SYNC_AT = "last_sync_at";
const LAST_SYNC_AT_BY_TABLE = {
  transactions: "last_sync_at_transactions",
  account_suggestion_dismissals: "last_sync_at_account_suggestion_dismissals",
  capture_evidence: "last_sync_at_capture_evidence",
  financial_accounts: "last_sync_at_financial_accounts",
  transfers: "last_sync_at_transfers",
  opening_balances: "last_sync_at_opening_balances",
  financial_account_identifiers: "last_sync_at_financial_account_identifiers",
} as const;
const PULL_PAGE_SIZE = 1000;

type SupabaseTransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  category_id: string;
  account_id?: string;
  account_attribution_state?: string;
  superseded_at?: string | null;
  description: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseFinancialAccountRow = {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  is_default: boolean;
  statement_closing_day: number | null;
  payment_due_day: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseTransferRow = {
  id: string;
  user_id: string;
  amount: number;
  from_account_id: string | null;
  to_account_id: string | null;
  from_external_label: string | null;
  to_external_label: string | null;
  description: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseOpeningBalanceRow = {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseFinancialAccountIdentifierRow = {
  id: string;
  user_id: string;
  account_id: string;
  scope: string;
  value: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseCaptureEvidenceRow = {
  id: string;
  user_id: string;
  source_family: string;
  evidence_type: string;
  scope: string;
  value: string;
  transaction_id: string | null;
  transfer_id?: string | null;
  processed_email_id: string | null;
  processed_capture_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseAccountSuggestionDismissalRow = {
  id: string;
  user_id: string;
  scope: string;
  value: string;
  dismissed_score: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const shouldUpdateLocal = (serverUpdatedAt: string, localUpdatedAt: string | undefined): boolean =>
  !localUpdatedAt || serverUpdatedAt > localUpdatedAt;

function fromSupabaseTransactionAccountDefaults(row: SupabaseTransactionRow) {
  return {
    accountId: row.account_id ?? buildDefaultFinancialAccountId(row.user_id),
    accountAttributionState: row.account_attribution_state ?? "confirmed",
  };
}

function fromSupabaseTransactionNullableFields(row: SupabaseTransactionRow) {
  return {
    supersededAt: row.superseded_at ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}

function fromSupabaseTransactionRow(row: SupabaseTransactionRow) {
  const accountDefaults = fromSupabaseTransactionAccountDefaults(row);
  const nullableFields = fromSupabaseTransactionNullableFields(row);
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    categoryId: row.category_id,
    accountId: accountDefaults.accountId,
    accountAttributionState: accountDefaults.accountAttributionState,
    supersededAt: nullableFields.supersededAt,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: nullableFields.deletedAt,
  };
}

function fromSupabaseFinancialAccountRow(
  row: SupabaseFinancialAccountRow
): Parameters<typeof upsertFinancialAccount>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    isDefault: row.is_default,
    statementClosingDay: row.statement_closing_day,
    paymentDueDay: row.payment_due_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertFinancialAccount>[1];
}

function fromSupabaseTransferRow(row: SupabaseTransferRow): Parameters<typeof upsertTransfer>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    fromExternalLabel: row.from_external_label,
    toExternalLabel: row.to_external_label,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertTransfer>[1];
}

function fromSupabaseOpeningBalanceRow(
  row: SupabaseOpeningBalanceRow
): Parameters<typeof upsertOpeningBalance>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    amount: row.amount,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertOpeningBalance>[1];
}

function fromSupabaseFinancialAccountIdentifierRow(
  row: SupabaseFinancialAccountIdentifierRow
): Parameters<typeof upsertFinancialAccountIdentifier>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    scope: row.scope,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertFinancialAccountIdentifier>[1];
}

function fromSupabaseCaptureEvidenceRow(
  row: SupabaseCaptureEvidenceRow
): Parameters<typeof upsertCaptureEvidence>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    sourceFamily: row.source_family,
    evidenceType: row.evidence_type,
    scope: row.scope,
    value: row.value,
    transactionId: row.transaction_id,
    transferId: row.transfer_id ?? null,
    processedEmailId: row.processed_email_id,
    processedCaptureId: row.processed_capture_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertCaptureEvidence>[1];
}

function fromSupabaseAccountSuggestionDismissalRow(
  row: SupabaseAccountSuggestionDismissalRow
): Parameters<typeof upsertAccountSuggestionDismissal>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    scope: row.scope,
    value: row.value,
    dismissedScore: row.dismissed_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertAccountSuggestionDismissal>[1];
}

type PullTableName = keyof typeof LAST_SYNC_AT_BY_TABLE;
type PullCursor = { updatedAt: string; id: string | null };
type PullFetchResponse<TRow extends { updated_at: string; id: string }> = {
  data: TRow[] | null;
  error: { message?: string; code?: string } | null;
};
type PullFetchOutcome<TRow extends { updated_at: string; id: string }> = {
  tableName: PullTableName;
  rows: TRow[];
  error: { message: string; code: string } | null;
};
type PushEntryContext = {
  db: AnyDb;
  supabase: SupabaseClient;
  rowId: string;
};
type PushEntryOutcome = { ok: true } | { ok: false; errorMessage: string; errorCode: string };
type PushEntryHandler = (context: PushEntryContext) => Promise<PushEntryOutcome>;
type UpsertPushSpec<TRow, TSupabaseRow> = {
  tableName: string;
  getRow: (db: AnyDb, rowId: string) => TRow | null | Promise<TRow | null>;
  mapRow: (row: TRow) => TSupabaseRow;
  upsertOptions?: { onConflict: string };
};
type PullFetchRequest = {
  supabase: SupabaseClient;
  userId: string;
  tableName: string;
  lastSyncAt: PullCursor | null;
};
type ApplyServerRowsRequest<
  TRow extends { id: string; updated_at: string },
  TMappedRow,
  TLocalRow extends { updatedAt: string } | null,
> = {
  db: AnyDb;
  rows: readonly TRow[];
  getLocalRow: (db: AnyDb, rowId: string) => TLocalRow;
  upsertLocalRow: (db: AnyDb, row: TMappedRow) => void;
  mapServerRow: (row: TRow) => TMappedRow;
};
type LocalTransactionRow = NonNullable<Awaited<ReturnType<typeof getTransactionById>>>;
type LocalBudgetRow = NonNullable<ReturnType<typeof getBudgetById>>;
type LocalGoalRow = NonNullable<ReturnType<typeof getGoalById>>;
type LocalFinancialAccountRow = NonNullable<ReturnType<typeof getFinancialAccountById>>;
type LocalTransferRow = NonNullable<ReturnType<typeof getTransferById>>;
type LocalOpeningBalanceRow = NonNullable<ReturnType<typeof getOpeningBalanceById>>;
type LocalFinancialAccountIdentifierRow = NonNullable<
  ReturnType<typeof getFinancialAccountIdentifierById>
>;
type LocalCaptureEvidenceRow = NonNullable<ReturnType<typeof getCaptureEvidenceById>>;
type LocalAccountSuggestionDismissalRow = NonNullable<
  ReturnType<typeof getAccountSuggestionDismissalById>
>;
type LocalContributionRow = NonNullable<ReturnType<typeof getContributionById>>;
const PUSH_ENTRY_PROCESSED: PushEntryOutcome = { ok: true };

const rowToPullCursor = (row: { updated_at: string; id: string }): PullCursor => ({
  updatedAt: row.updated_at,
  id: row.id,
});

const serializePullCursor = (cursor: PullCursor): string => JSON.stringify(cursor);

function parsePullCursor(value: string): PullCursor {
  try {
    const parsed = JSON.parse(value) as {
      updatedAt?: unknown;
      id?: unknown;
    };
    const updatedAt = readParsedPullCursorUpdatedAt(parsed);
    const id = readParsedPullCursorId(parsed);
    if (updatedAt && id !== undefined) {
      return {
        updatedAt,
        id,
      };
    }
  } catch {
    // Legacy timestamp-only cursor
  }

  return {
    updatedAt: value,
    id: null,
  };
}

function readParsedPullCursorUpdatedAt(parsed: { updatedAt?: unknown }) {
  return typeof parsed.updatedAt === "string" ? parsed.updatedAt : null;
}

function readParsedPullCursorId(parsed: { id?: unknown }) {
  return parsed.id == null || typeof parsed.id === "string" ? (parsed.id ?? null) : undefined;
}

const toCompositeCursorFilter = (cursor: PullCursor): string =>
  `updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`;

async function fetchPullRows<T extends { updated_at: string; id: string }>(
  request: PullFetchRequest
) {
  const baseQuery = request.supabase
    .from(request.tableName)
    .select("*")
    .eq("user_id", request.userId);
  const query = !request.lastSyncAt
    ? baseQuery
    : request.lastSyncAt.id == null
      ? baseQuery.gte("updated_at", request.lastSyncAt.updatedAt)
      : baseQuery.or(toCompositeCursorFilter(request.lastSyncAt));
  return (await query
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(PULL_PAGE_SIZE)) as PullFetchResponse<T>;
}

function hasPullFetchErrorFields(error: unknown): error is { message?: unknown; code?: unknown } {
  return typeof error === "object" && error !== null;
}

function readPullFetchErrorMessage(error: { message?: unknown }) {
  return typeof error.message === "string" ? error.message : "unknown";
}

function readPullFetchErrorCode(error: { code?: unknown }) {
  return typeof error.code === "string" ? error.code : "unknown";
}

function toPullFetchError(error: unknown) {
  if (typeof error === "string") {
    return {
      message: error,
      code: "unknown",
    };
  }

  if (!hasPullFetchErrorFields(error)) {
    return {
      message: "unknown",
      code: "unknown",
    };
  }

  return {
    message: readPullFetchErrorMessage(error),
    code: readPullFetchErrorCode(error),
  };
}

function toMissingPullFetchError(response: PullFetchResponse<{ updated_at: string; id: string }>) {
  return {
    message: response.error?.message ?? "no_data",
    code: response.error?.code ?? "unknown",
  };
}

function getLocalAccountSuggestionDismissalRow(database: AnyDb, rowId: string) {
  return getAccountSuggestionDismissalById(
    database,
    rowId as Parameters<typeof getAccountSuggestionDismissalById>[1]
  );
}

function getLocalCaptureEvidenceRow(database: AnyDb, rowId: string) {
  return getCaptureEvidenceById(database, rowId as Parameters<typeof getCaptureEvidenceById>[1]);
}

function getLocalFinancialAccountRow(database: AnyDb, rowId: string) {
  return getFinancialAccountById(database, rowId as Parameters<typeof getFinancialAccountById>[1]);
}

function getLocalTransferRow(database: AnyDb, rowId: string) {
  return getTransferById(database, rowId as Parameters<typeof getTransferById>[1]);
}

function getLocalOpeningBalanceRow(database: AnyDb, rowId: string) {
  return getOpeningBalanceById(database, rowId as Parameters<typeof getOpeningBalanceById>[1]);
}

function getLocalFinancialAccountIdentifierRow(database: AnyDb, rowId: string) {
  return getFinancialAccountIdentifierById(
    database,
    rowId as Parameters<typeof getFinancialAccountIdentifierById>[1]
  );
}

function toPullFetchOutcome<TRow extends { updated_at: string; id: string }>(
  tableName: PullTableName,
  result: PromiseSettledResult<PullFetchResponse<TRow>>
): PullFetchOutcome<TRow> {
  if (result.status === "rejected") {
    return {
      tableName,
      rows: [],
      error: toPullFetchError(result.reason),
    };
  }

  if (result.value.error || !result.value.data) {
    return {
      tableName,
      rows: [],
      error: toMissingPullFetchError(result.value),
    };
  }

  return {
    tableName,
    rows: result.value.data,
    error: null,
  };
}

async function getPullCursor(db: AnyDb, tableName: PullTableName) {
  const tableCursor = await getSyncMeta(db, LAST_SYNC_AT_BY_TABLE[tableName]);
  if (tableCursor) {
    return parsePullCursor(tableCursor);
  }

  if (tableName === "transactions") {
    const legacyCursor = await getSyncMeta(db, LEGACY_LAST_SYNC_AT);
    return legacyCursor ? parsePullCursor(legacyCursor) : null;
  }

  return null;
}

async function setPullCursor(db: AnyDb, tableName: PullTableName, value: PullCursor) {
  await setSyncMeta(db, LAST_SYNC_AT_BY_TABLE[tableName], serializePullCursor(value));

  if (tableName === "transactions") {
    await setSyncMeta(db, LEGACY_LAST_SYNC_AT, value.updatedAt);
  }
}

async function advancePullCursor(
  db: AnyDb,
  tableName: PullTableName,
  safeCursor: PullCursor | null
) {
  // Leave empty initial pulls uninitialized so later rows cannot be skipped by a synthetic cursor.
  if (safeCursor) {
    await setPullCursor(db, tableName, safeCursor);
  }
}

function applyServerRows<
  TRow extends { id: string; updated_at: string },
  TMappedRow,
  TLocalRow extends { updatedAt: string } | null,
>(request: ApplyServerRowsRequest<TRow, TMappedRow, TLocalRow>) {
  let failedCount = 0;
  let safeCursor: PullCursor | null = null;
  let sawFailure = false;

  for (const serverRow of request.rows) {
    try {
      const localRow = request.getLocalRow(request.db, serverRow.id);
      if (shouldUpdateLocal(serverRow.updated_at, localRow?.updatedAt)) {
        request.upsertLocalRow(request.db, request.mapServerRow(serverRow));
      }
      if (!sawFailure) {
        safeCursor = rowToPullCursor(serverRow);
      }
    } catch (error) {
      captureError(error);
      failedCount++;
      sawFailure = true;
    }
  }

  return { failedCount, safeCursor };
}

function toPushEntryFailure(error: { message?: string; code?: string }) {
  return {
    ok: false,
    errorMessage: error.message ?? "unknown",
    errorCode: error.code ?? "unknown",
  };
}

function toSupabaseTransactionAccountDefaults(row: LocalTransactionRow) {
  return {
    accountId: row.accountId ?? buildDefaultFinancialAccountId(row.userId),
    accountAttributionState: row.accountAttributionState ?? "confirmed",
  };
}

function toSupabaseTransactionDeleteFields(row: LocalTransactionRow) {
  return {
    supersededAt: row.supersededAt ?? null,
    deletedAt: row.deletedAt ?? null,
  };
}

function toSupabaseTransactionDescription(row: LocalTransactionRow) {
  return row.description ?? null;
}

function toSupabaseTransactionRow(row: LocalTransactionRow): SupabaseTransactionRow {
  const accountDefaults = toSupabaseTransactionAccountDefaults(row);
  const deleteFields = toSupabaseTransactionDeleteFields(row);
  const description = toSupabaseTransactionDescription(row);
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type,
    amount: row.amount,
    category_id: row.categoryId,
    account_id: accountDefaults.accountId,
    account_attribution_state: accountDefaults.accountAttributionState,
    superseded_at: deleteFields.supersededAt,
    description,
    date: row.date,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: deleteFields.deletedAt,
  };
}

const toSupabaseBudgetRow = (row: LocalBudgetRow) => ({
  id: row.id,
  user_id: row.userId,
  category_id: row.categoryId,
  amount: row.amount,
  month: row.month,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

const toSupabaseGoalRow = (row: LocalGoalRow) => ({
  id: row.id,
  user_id: row.userId,
  name: row.name,
  type: row.type,
  target_amount: row.targetAmount,
  target_date: row.targetDate,
  interest_rate_percent: row.interestRatePercent,
  icon_name: row.iconName,
  color_hex: row.colorHex,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

const toSupabaseFinancialAccountDays = (row: LocalFinancialAccountRow) => ({
  statementClosingDay: row.statementClosingDay ?? null,
  paymentDueDay: row.paymentDueDay ?? null,
});

const toSupabaseFinancialAccountRow = (row: LocalFinancialAccountRow) => {
  const days = toSupabaseFinancialAccountDays(row);
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    kind: row.kind,
    is_default: row.isDefault,
    statement_closing_day: days.statementClosingDay,
    payment_due_day: days.paymentDueDay,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  };
};

const toSupabaseTransferRow = (row: LocalTransferRow) => ({
  id: row.id,
  user_id: row.userId,
  amount: row.amount,
  from_account_id: row.fromAccountId,
  to_account_id: row.toAccountId,
  from_external_label: row.fromExternalLabel,
  to_external_label: row.toExternalLabel,
  description: row.description,
  date: row.date,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

const toSupabaseOpeningBalanceRow = (row: LocalOpeningBalanceRow) => ({
  id: row.id,
  user_id: row.userId,
  account_id: row.accountId,
  amount: row.amount,
  effective_date: row.effectiveDate,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

const toSupabaseFinancialAccountIdentifierRow = (row: LocalFinancialAccountIdentifierRow) => ({
  id: row.id,
  user_id: row.userId,
  account_id: row.accountId,
  scope: row.scope,
  value: row.value,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

const toSupabaseCaptureEvidenceRow = (row: LocalCaptureEvidenceRow) => ({
  id: row.id,
  user_id: row.userId,
  source_family: row.sourceFamily,
  evidence_type: row.evidenceType,
  scope: row.scope,
  value: row.value,
  transaction_id: row.transactionId,
  transfer_id: row.transferId ?? null,
  processed_email_id: row.processedEmailId,
  processed_capture_id: row.processedCaptureId,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

const toSupabaseAccountSuggestionDismissalRow = (row: LocalAccountSuggestionDismissalRow) => ({
  id: row.id,
  user_id: row.userId,
  scope: row.scope,
  value: row.value,
  dismissed_score: row.dismissedScore,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

const toSupabaseContributionRow = (row: LocalContributionRow) => ({
  id: row.id,
  goal_id: row.goalId,
  user_id: row.userId,
  amount: row.amount,
  note: row.note,
  date: row.date,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

async function upsertPushRow<TRow, TSupabaseRow>(
  context: PushEntryContext,
  spec: UpsertPushSpec<TRow, TSupabaseRow>
): Promise<PushEntryOutcome> {
  const row = await spec.getRow(context.db, context.rowId);
  if (!row) {
    return PUSH_ENTRY_PROCESSED;
  }

  const query = context.supabase.from(spec.tableName);
  const payload = spec.mapRow(row);
  const response = spec.upsertOptions
    ? await query.upsert(payload, spec.upsertOptions)
    : await query.upsert(payload);

  return response.error ? toPushEntryFailure(response.error) : PUSH_ENTRY_PROCESSED;
}

const processTransactionEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "transactions",
    getRow: (db, rowId) => getTransactionById(db, requireTransactionId(rowId)),
    mapRow: toSupabaseTransactionRow,
  });

const processBudgetEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "budgets",
    getRow: (db, rowId) => getBudgetById(db, requireBudgetId(rowId)),
    mapRow: toSupabaseBudgetRow,
  });

const processGoalEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "goals",
    getRow: (db, rowId) => getGoalById(db, rowId),
    mapRow: toSupabaseGoalRow,
  });

const processFinancialAccountEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "financial_accounts",
    getRow: (db, rowId) =>
      getFinancialAccountById(db, rowId as Parameters<typeof getFinancialAccountById>[1]),
    mapRow: toSupabaseFinancialAccountRow,
  });

const processTransferEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "transfers",
    getRow: (db, rowId) => getTransferById(db, rowId as Parameters<typeof getTransferById>[1]),
    mapRow: toSupabaseTransferRow,
  });

const processOpeningBalanceEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "opening_balances",
    getRow: (db, rowId) =>
      getOpeningBalanceById(db, rowId as Parameters<typeof getOpeningBalanceById>[1]),
    mapRow: toSupabaseOpeningBalanceRow,
    upsertOptions: { onConflict: "account_id" },
  });

const processFinancialAccountIdentifierEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "financial_account_identifiers",
    getRow: (db, rowId) =>
      getFinancialAccountIdentifierById(
        db,
        rowId as Parameters<typeof getFinancialAccountIdentifierById>[1]
      ),
    mapRow: toSupabaseFinancialAccountIdentifierRow,
    upsertOptions: { onConflict: "user_id,account_id,scope,value" },
  });

const processCaptureEvidenceEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "capture_evidence",
    getRow: (db, rowId) =>
      getCaptureEvidenceById(db, rowId as Parameters<typeof getCaptureEvidenceById>[1]),
    mapRow: toSupabaseCaptureEvidenceRow,
  });

const processAccountSuggestionDismissalEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "account_suggestion_dismissals",
    getRow: (db, rowId) =>
      getAccountSuggestionDismissalById(
        db,
        rowId as Parameters<typeof getAccountSuggestionDismissalById>[1]
      ),
    mapRow: toSupabaseAccountSuggestionDismissalRow,
    upsertOptions: { onConflict: "user_id,scope,value" },
  });

const processContributionEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "goal_contributions",
    getRow: (db, rowId) => getContributionById(db, rowId),
    mapRow: toSupabaseContributionRow,
  });

const PUSH_ENTRY_HANDLERS = {
  transactions: processTransactionEntry,
  budgets: processBudgetEntry,
  financialAccounts: processFinancialAccountEntry,
  accountSuggestionDismissals: processAccountSuggestionDismissalEntry,
  captureEvidence: processCaptureEvidenceEntry,
  transfers: processTransferEntry,
  openingBalances: processOpeningBalanceEntry,
  financialAccountIdentifiers: processFinancialAccountIdentifierEntry,
  goals: processGoalEntry,
  goalContributions: processContributionEntry,
} satisfies Record<string, PushEntryHandler>;

function getPushEntryHandler(tableName: string): PushEntryHandler | null {
  return PUSH_ENTRY_HANDLERS[tableName as keyof typeof PUSH_ENTRY_HANDLERS] ?? null;
}

function capturePushEntryFailure(
  tableName: string,
  outcome: Extract<PushEntryOutcome, { ok: false }>
) {
  captureWarning("sync_push_entry_failed", {
    tableName,
    errorMessage: outcome.errorMessage,
    errorCode: outcome.errorCode,
  });
}

async function processEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  entry: { id: SyncQueueId; tableName: string; rowId: string }
): Promise<SyncQueueId | null> {
  const handler = getPushEntryHandler(entry.tableName);
  if (!handler) {
    captureWarning("sync_push_unknown_table", { tableName: entry.tableName });
    return null;
  }

  const outcome = await handler({ db, supabase, rowId: entry.rowId });
  if (!outcome.ok) {
    capturePushEntryFailure(entry.tableName, outcome);
  }
  return outcome.ok ? entry.id : null;
}

export async function syncPush(
  db: AnyDb,
  supabase: SupabaseClient,
  _userId: string
): Promise<void> {
  const entries = await getQueuedSyncEntries(db);
  if (entries.length === 0) return;

  const results = await Promise.allSettled(entries.map((e) => processEntry(db, supabase, e)));
  const processedIds = results
    .filter(
      (r): r is PromiseFulfilledResult<SyncQueueId> => r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);

  if (processedIds.length > 0) {
    await clearSyncEntries(db, processedIds);
  }

  capturePipelineEvent({
    source: "sync_push",
    queued: entries.length,
    succeeded: processedIds.length,
    failed: entries.length - processedIds.length,
  });
}

type PullCursorState = {
  accountSuggestionDismissals: PullCursor | null;
  captureEvidence: PullCursor | null;
  financialAccounts: PullCursor | null;
  transfers: PullCursor | null;
  openingBalances: PullCursor | null;
  financialAccountIdentifiers: PullCursor | null;
  transactions: PullCursor | null;
};

type PullResults = {
  accountSuggestionDismissals: PullFetchOutcome<SupabaseAccountSuggestionDismissalRow>;
  captureEvidence: PullFetchOutcome<SupabaseCaptureEvidenceRow>;
  financialAccounts: PullFetchOutcome<SupabaseFinancialAccountRow>;
  transfers: PullFetchOutcome<SupabaseTransferRow>;
  openingBalances: PullFetchOutcome<SupabaseOpeningBalanceRow>;
  financialAccountIdentifiers: PullFetchOutcome<SupabaseFinancialAccountIdentifierRow>;
  transactions: PullFetchOutcome<SupabaseTransactionRow>;
};

type NonTransactionPullOutcome = {
  failedCount: number;
  safeCursors: {
    accountSuggestionDismissals: PullCursor | null;
    captureEvidence: PullCursor | null;
    financialAccounts: PullCursor | null;
    transfers: PullCursor | null;
    openingBalances: PullCursor | null;
    financialAccountIdentifiers: PullCursor | null;
  };
};

type TransactionPullOutcome = {
  failedCount: number;
  conflictCount: number;
  safeCursor: PullCursor | null;
};

type ComparableTransactionRow = ReturnType<typeof fromSupabaseTransactionRow>;
type MaybeLocalTransactionRow = Awaited<ReturnType<typeof getTransactionById>>;

async function getAllPullCursors(db: AnyDb): Promise<PullCursorState> {
  const [
    accountSuggestionDismissals,
    captureEvidence,
    financialAccounts,
    transfers,
    openingBalances,
    financialAccountIdentifiers,
    transactions,
  ] = await Promise.all([
    getPullCursor(db, "account_suggestion_dismissals"),
    getPullCursor(db, "capture_evidence"),
    getPullCursor(db, "financial_accounts"),
    getPullCursor(db, "transfers"),
    getPullCursor(db, "opening_balances"),
    getPullCursor(db, "financial_account_identifiers"),
    getPullCursor(db, "transactions"),
  ]);

  return {
    accountSuggestionDismissals,
    captureEvidence,
    financialAccounts,
    transfers,
    openingBalances,
    financialAccountIdentifiers,
    transactions,
  };
}

async function fetchAllPullResults(input: {
  supabase: SupabaseClient;
  userId: string;
  cursors: PullCursorState;
}): Promise<PullResults> {
  const settledResults = await Promise.allSettled([
    fetchPullRows<SupabaseAccountSuggestionDismissalRow>({
      supabase: input.supabase,
      userId: input.userId,
      tableName: "account_suggestion_dismissals",
      lastSyncAt: input.cursors.accountSuggestionDismissals,
    }),
    fetchPullRows<SupabaseCaptureEvidenceRow>({
      supabase: input.supabase,
      userId: input.userId,
      tableName: "capture_evidence",
      lastSyncAt: input.cursors.captureEvidence,
    }),
    fetchPullRows<SupabaseFinancialAccountRow>({
      supabase: input.supabase,
      userId: input.userId,
      tableName: "financial_accounts",
      lastSyncAt: input.cursors.financialAccounts,
    }),
    fetchPullRows<SupabaseTransferRow>({
      supabase: input.supabase,
      userId: input.userId,
      tableName: "transfers",
      lastSyncAt: input.cursors.transfers,
    }),
    fetchPullRows<SupabaseOpeningBalanceRow>({
      supabase: input.supabase,
      userId: input.userId,
      tableName: "opening_balances",
      lastSyncAt: input.cursors.openingBalances,
    }),
    fetchPullRows<SupabaseFinancialAccountIdentifierRow>({
      supabase: input.supabase,
      userId: input.userId,
      tableName: "financial_account_identifiers",
      lastSyncAt: input.cursors.financialAccountIdentifiers,
    }),
    fetchPullRows<SupabaseTransactionRow>({
      supabase: input.supabase,
      userId: input.userId,
      tableName: "transactions",
      lastSyncAt: input.cursors.transactions,
    }),
  ]);
  const [dismissals, evidence, accounts, transfers, balances, identifiers, transactions] =
    settledResults;

  return {
    accountSuggestionDismissals: toPullFetchOutcome("account_suggestion_dismissals", dismissals),
    captureEvidence: toPullFetchOutcome("capture_evidence", evidence),
    financialAccounts: toPullFetchOutcome("financial_accounts", accounts),
    transfers: toPullFetchOutcome("transfers", transfers),
    openingBalances: toPullFetchOutcome("opening_balances", balances),
    financialAccountIdentifiers: toPullFetchOutcome("financial_account_identifiers", identifiers),
    transactions: toPullFetchOutcome("transactions", transactions),
  };
}

function listPullResults(results: PullResults) {
  return [
    results.accountSuggestionDismissals,
    results.captureEvidence,
    results.financialAccounts,
    results.transfers,
    results.openingBalances,
    results.financialAccountIdentifiers,
    results.transactions,
  ];
}

function capturePullFetchWarnings(results: PullResults) {
  for (const failedFetch of listPullResults(results)) {
    if (!failedFetch.error) {
      continue;
    }

    captureWarning("sync_pull_fetch_failed", toPullFetchWarningPayload(failedFetch));
  }
}

function countFetchedRows(results: PullResults) {
  return listPullResults(results).reduce((count, result) => count + result.rows.length, 0);
}

function toPullFetchWarningPayload(
  failedFetch: Extract<
    ReturnType<typeof listPullResults>[number],
    { error: NonNullable<PullFetchOutcome<{ updated_at: string; id: string }>["error"]> | null }
  >
) {
  return {
    tableName: failedFetch.tableName,
    errorMessage: failedFetch.error?.message ?? "no_data",
    errorCode: failedFetch.error?.code ?? "unknown",
  };
}

function applyAccountSuggestionDismissalRows(
  db: AnyDb,
  rows: SupabaseAccountSuggestionDismissalRow[]
) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalAccountSuggestionDismissalRow,
    upsertLocalRow: upsertAccountSuggestionDismissal,
    mapServerRow: fromSupabaseAccountSuggestionDismissalRow,
  });
}

function applyCaptureEvidenceRows(db: AnyDb, rows: SupabaseCaptureEvidenceRow[]) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalCaptureEvidenceRow,
    upsertLocalRow: upsertCaptureEvidence,
    mapServerRow: fromSupabaseCaptureEvidenceRow,
  });
}

function applyFinancialAccountRows(db: AnyDb, rows: SupabaseFinancialAccountRow[]) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalFinancialAccountRow,
    upsertLocalRow: upsertFinancialAccount,
    mapServerRow: fromSupabaseFinancialAccountRow,
  });
}

function applyTransferRows(db: AnyDb, rows: SupabaseTransferRow[]) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalTransferRow,
    upsertLocalRow: upsertTransfer,
    mapServerRow: fromSupabaseTransferRow,
  });
}

function applyOpeningBalanceRows(db: AnyDb, rows: SupabaseOpeningBalanceRow[]) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalOpeningBalanceRow,
    upsertLocalRow: upsertOpeningBalance,
    mapServerRow: fromSupabaseOpeningBalanceRow,
  });
}

function applyFinancialAccountIdentifierRows(
  db: AnyDb,
  rows: SupabaseFinancialAccountIdentifierRow[]
) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalFinancialAccountIdentifierRow,
    upsertLocalRow: upsertFinancialAccountIdentifier,
    mapServerRow: fromSupabaseFinancialAccountIdentifierRow,
  });
}

type NonTransactionRowOutcomes = {
  accountSuggestionDismissals: ReturnType<typeof applyAccountSuggestionDismissalRows>;
  captureEvidence: ReturnType<typeof applyCaptureEvidenceRows>;
  financialAccounts: ReturnType<typeof applyFinancialAccountRows>;
  transfers: ReturnType<typeof applyTransferRows>;
  openingBalances: ReturnType<typeof applyOpeningBalanceRows>;
  financialAccountIdentifiers: ReturnType<typeof applyFinancialAccountIdentifierRows>;
};

function countNonTransactionFailedRows(outcomes: NonTransactionRowOutcomes) {
  return (
    outcomes.accountSuggestionDismissals.failedCount +
    outcomes.captureEvidence.failedCount +
    outcomes.financialAccounts.failedCount +
    outcomes.transfers.failedCount +
    outcomes.openingBalances.failedCount +
    outcomes.financialAccountIdentifiers.failedCount
  );
}

function getNonTransactionSafeCursors(outcomes: NonTransactionRowOutcomes) {
  return {
    accountSuggestionDismissals: outcomes.accountSuggestionDismissals.safeCursor,
    captureEvidence: outcomes.captureEvidence.safeCursor,
    financialAccounts: outcomes.financialAccounts.safeCursor,
    transfers: outcomes.transfers.safeCursor,
    openingBalances: outcomes.openingBalances.safeCursor,
    financialAccountIdentifiers: outcomes.financialAccountIdentifiers.safeCursor,
  };
}

function applyNonTransactionPullRows(db: AnyDb, results: PullResults): NonTransactionPullOutcome {
  const outcomes: NonTransactionRowOutcomes = {
    accountSuggestionDismissals: applyAccountSuggestionDismissalRows(
      db,
      results.accountSuggestionDismissals.rows
    ),
    captureEvidence: applyCaptureEvidenceRows(db, results.captureEvidence.rows),
    financialAccounts: applyFinancialAccountRows(db, results.financialAccounts.rows),
    transfers: applyTransferRows(db, results.transfers.rows),
    openingBalances: applyOpeningBalanceRows(db, results.openingBalances.rows),
    financialAccountIdentifiers: applyFinancialAccountIdentifierRows(
      db,
      results.financialAccountIdentifiers.rows
    ),
  };

  return {
    failedCount: countNonTransactionFailedRows(outcomes),
    safeCursors: getNonTransactionSafeCursors(outcomes),
  };
}

function toComparableTransactionRow(row: ComparableTransactionRow) {
  return {
    ...row,
    description: row.description ?? null,
    deletedAt: row.deletedAt ?? null,
  };
}

function toComparableLocalTransactionRow(row: LocalTransactionRow) {
  return {
    ...row,
    ...toSupabaseTransactionAccountDefaults(row),
    ...toSupabaseTransactionDeleteFields(row),
    description: toSupabaseTransactionDescription(row),
  };
}
function hasTransactionPullConflict(
  localRow: MaybeLocalTransactionRow,
  mappedServerRow: ComparableTransactionRow
) {
  return (
    localRow != null &&
    hasDataConflict(
      toComparableLocalTransactionRow(localRow),
      toComparableTransactionRow(mappedServerRow)
    )
  );
}

function captureTransactionPullConflict(input: {
  db: AnyDb;
  transactionId: ReturnType<typeof requireTransactionId>;
  localRow: MaybeLocalTransactionRow;
  mappedServerRow: ComparableTransactionRow;
}) {
  const conflict = buildTransactionPullConflict(input);
  try {
    insertConflict(input.db, conflict);
  } catch (conflictError) {
    captureError(conflictError);
  }
}

const buildTransactionPullConflict = (input: {
  transactionId: ReturnType<typeof requireTransactionId>;
  localRow: MaybeLocalTransactionRow;
  mappedServerRow: ComparableTransactionRow;
}) => ({
  id: generateSyncConflictId(),
  transactionId: input.transactionId,
  localData: JSON.stringify(input.localRow),
  serverData: JSON.stringify(input.mappedServerRow),
  detectedAt: toIsoDateTime(new Date()),
});

async function applyTransactionPullRow(input: { db: AnyDb; serverRow: SupabaseTransactionRow }) {
  try {
    const transactionId = requireTransactionId(input.serverRow.id);
    const localRow = await getTransactionById(input.db, transactionId);
    const mappedServerRow = fromSupabaseTransactionRow(input.serverRow);
    if (!shouldUpdateLocal(input.serverRow.updated_at, localRow?.updatedAt)) {
      return { failed: false, conflict: false };
    }

    const conflict = hasTransactionPullConflict(localRow, mappedServerRow);
    await upsertTransaction(input.db, mappedServerRow as Parameters<typeof upsertTransaction>[1]);
    if (conflict) {
      captureTransactionPullConflict({
        db: input.db,
        transactionId,
        localRow,
        mappedServerRow,
      });
    }
    return { failed: false, conflict };
  } catch (error) {
    captureError(error);
    return { failed: true, conflict: false };
  }
}

type TransactionPullProgress = TransactionPullOutcome & { sawFailure: boolean };

function nextTransactionPullProgress(
  progress: TransactionPullProgress,
  outcome: { failed: boolean; conflict: boolean },
  serverRow: SupabaseTransactionRow
): TransactionPullProgress {
  const sawFailure = progress.sawFailure || outcome.failed;
  return {
    failedCount: progress.failedCount + Number(outcome.failed),
    conflictCount: progress.conflictCount + Number(outcome.conflict),
    safeCursor: sawFailure ? progress.safeCursor : rowToPullCursor(serverRow),
    sawFailure,
  };
}

async function applyTransactionPullRows(
  db: AnyDb,
  rows: SupabaseTransactionRow[]
): Promise<TransactionPullOutcome> {
  let progress: TransactionPullProgress = {
    failedCount: 0,
    conflictCount: 0,
    safeCursor: null,
    sawFailure: false,
  };

  for (const serverRow of rows) {
    const outcome = await applyTransactionPullRow({ db, serverRow });
    progress = nextTransactionPullProgress(progress, outcome, serverRow);
  }

  return {
    failedCount: progress.failedCount,
    conflictCount: progress.conflictCount,
    safeCursor: progress.safeCursor,
  };
}

function captureSyncPullEvent(input: {
  results: PullResults;
  nonTransactionOutcome: NonTransactionPullOutcome;
  transactionOutcome: TransactionPullOutcome;
}) {
  capturePipelineEvent({
    source: "sync_pull",
    rowsFetched: countFetchedRows(input.results),
    rowsApplied:
      countFetchedRows(input.results) -
      input.nonTransactionOutcome.failedCount -
      input.transactionOutcome.failedCount,
    conflicts: input.transactionOutcome.conflictCount,
    failed: input.nonTransactionOutcome.failedCount + input.transactionOutcome.failedCount,
  });
}

async function advanceSyncPullCursors(input: {
  db: AnyDb;
  nonTransactionOutcome: NonTransactionPullOutcome;
  transactionSafeCursor: PullCursor | null;
}) {
  const cursorAdvancements = getSyncPullCursorAdvancements(input);
  await Promise.all(
    cursorAdvancements.map(({ tableName, cursor }) =>
      advancePullCursor(input.db, tableName, cursor)
    )
  );
}

function getSyncPullCursorAdvancements(input: {
  nonTransactionOutcome: NonTransactionPullOutcome;
  transactionSafeCursor: PullCursor | null;
}) {
  return [
    {
      tableName: "account_suggestion_dismissals" as const,
      cursor: input.nonTransactionOutcome.safeCursors.accountSuggestionDismissals,
    },
    {
      tableName: "capture_evidence" as const,
      cursor: input.nonTransactionOutcome.safeCursors.captureEvidence,
    },
    {
      tableName: "financial_accounts" as const,
      cursor: input.nonTransactionOutcome.safeCursors.financialAccounts,
    },
    { tableName: "transfers" as const, cursor: input.nonTransactionOutcome.safeCursors.transfers },
    {
      tableName: "opening_balances" as const,
      cursor: input.nonTransactionOutcome.safeCursors.openingBalances,
    },
    {
      tableName: "financial_account_identifiers" as const,
      cursor: input.nonTransactionOutcome.safeCursors.financialAccountIdentifiers,
    },
    { tableName: "transactions" as const, cursor: input.transactionSafeCursor },
  ];
}

export async function syncPull(
  db: AnyDb,
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const cursors = await getAllPullCursors(db);
  const results = await fetchAllPullResults({ supabase, userId, cursors });
  const nonTransactionOutcome = applyNonTransactionPullRows(db, results);
  const transactionOutcome = await applyTransactionPullRows(db, results.transactions.rows);

  capturePullFetchWarnings(results);
  captureSyncPullEvent({ results, nonTransactionOutcome, transactionOutcome });
  await advanceSyncPullCursors({
    db,
    nonTransactionOutcome,
    transactionSafeCursor: transactionOutcome.safeCursor,
  });

  return results.transactions.error == null;
}

export async function fullSync(
  db: AnyDb,
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const pullOk = await syncPull(db, supabase, userId);
  if (pullOk) {
    await syncPush(db, supabase, userId);
  }
  return pullOk;
}
