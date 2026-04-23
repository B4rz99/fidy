// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import { getSyncMeta, setSyncMeta } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import { captureWarning } from "@/shared/lib";
import type {
  PullCursor,
  PullCursorState,
  PullFetchOutcome,
  PullFetchRequest,
  PullFetchResponse,
  PullResults,
  PullTableName,
  SupabaseAccountSuggestionDismissalRow,
  SupabaseCaptureEvidenceRow,
  SupabaseFinancialAccountIdentifierRow,
  SupabaseFinancialAccountRow,
  SupabaseOpeningBalanceRow,
  SupabaseTransactionRow,
  SupabaseTransferRow,
} from "./types";
import { LAST_SYNC_AT_BY_TABLE, LEGACY_LAST_SYNC_AT, PULL_PAGE_SIZE } from "./types";

export const rowToPullCursor = (row: { updated_at: string; id: string }): PullCursor => ({
  updatedAt: row.updated_at,
  id: row.id,
});

const serializePullCursor = (cursor: PullCursor): string => JSON.stringify(cursor);

function parsePullCursor(value: string): PullCursor {
  try {
    const parsed = JSON.parse(value) as { updatedAt?: unknown; id?: unknown };
    const updatedAt = readParsedPullCursorUpdatedAt(parsed);
    const id = readParsedPullCursorId(parsed);
    if (updatedAt && id !== undefined) {
      return { updatedAt, id };
    }
  } catch {
    // Legacy timestamp-only cursor
  }

  return { updatedAt: value, id: null };
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
    return { message: error, code: "unknown" };
  }

  if (!hasPullFetchErrorFields(error)) {
    return { message: "unknown", code: "unknown" };
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

function toPullFetchOutcome<TRow extends { updated_at: string; id: string }>(
  tableName: PullTableName,
  result: PromiseSettledResult<PullFetchResponse<TRow>>
): PullFetchOutcome<TRow> {
  if (result.status === "rejected") {
    return { tableName, rows: [], error: toPullFetchError(result.reason) };
  }

  if (result.value.error || !result.value.data) {
    return { tableName, rows: [], error: toMissingPullFetchError(result.value) };
  }

  return { tableName, rows: result.value.data, error: null };
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

export async function advancePullCursor(
  db: AnyDb,
  tableName: PullTableName,
  safeCursor: PullCursor | null
) {
  if (safeCursor) {
    await setPullCursor(db, tableName, safeCursor);
  }
}

export async function getAllPullCursors(db: AnyDb): Promise<PullCursorState> {
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

export async function fetchAllPullResults(input: {
  supabase: PullFetchRequest["supabase"];
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

export function capturePullFetchWarnings(results: PullResults) {
  for (const failedFetch of listPullResults(results)) {
    if (!failedFetch.error) {
      continue;
    }

    captureWarning("sync_pull_fetch_failed", toPullFetchWarningPayload(failedFetch));
  }
}

export function countFetchedRows(results: PullResults) {
  return listPullResults(results).reduce((count, result) => count + result.rows.length, 0);
}
