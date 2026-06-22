import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  LedgerCursor,
  TransactionId,
} from "@/shared/types/branded";
import { fetchCloudLedgerBootstrap } from "./api-client";

export type CloudLedgerCategory = {
  readonly id: CategoryId;
  readonly name: string;
  readonly icon: string | null;
  readonly color: string | null;
  readonly updatedAt: IsoDateTime;
};

export type CloudLedgerFinancialAccount = {
  readonly id: FinancialAccountId;
  readonly name: string;
  readonly type: string;
  readonly currency: "COP";
  readonly updatedAt: IsoDateTime;
};

export type CloudLedgerTransaction = {
  readonly id: TransactionId;
  readonly type: "income" | "expense";
  readonly amount: CopAmount;
  readonly currency: "COP";
  readonly categoryId: CategoryId | null;
  readonly accountId: FinancialAccountId;
  readonly description: string | null;
  readonly date: IsoDate;
  readonly updatedAt: IsoDateTime;
};

export type CloudLedgerTombstoneRecordType = "category" | "financialAccount" | "transaction";

export type CloudLedgerTombstone = {
  readonly recordType: CloudLedgerTombstoneRecordType;
  readonly recordId: string;
  readonly deletedAt: IsoDateTime;
};

export type CloudLedgerBootstrapPayload = {
  readonly cursor: LedgerCursor;
  readonly categories: readonly CloudLedgerCategory[];
  readonly financialAccounts: readonly CloudLedgerFinancialAccount[];
  readonly transactions: readonly CloudLedgerTransaction[];
  readonly tombstones: readonly CloudLedgerTombstone[];
};

export type CloudLedgerCache = {
  readonly cursor: LedgerCursor | null;
  readonly categories: readonly CloudLedgerCategory[];
  readonly financialAccounts: readonly CloudLedgerFinancialAccount[];
  readonly transactions: readonly CloudLedgerTransaction[];
};

export function createEmptyCloudLedgerCache(): CloudLedgerCache {
  return {
    cursor: null,
    categories: [],
    financialAccounts: [],
    transactions: [],
  };
}

export async function refreshCloudLedgerCache(
  supabase: SupabaseClient,
  cache: CloudLedgerCache
): Promise<CloudLedgerCache> {
  return applyCloudLedgerBootstrap(cache, await fetchCloudLedgerBootstrap(supabase, cache.cursor));
}

export function applyCloudLedgerBootstrap(
  cache: CloudLedgerCache,
  payload: CloudLedgerBootstrapPayload
): CloudLedgerCache {
  const categories = upsertById(cache.categories, payload.categories);
  const financialAccounts = upsertById(cache.financialAccounts, payload.financialAccounts);
  const transactions = upsertById(cache.transactions, payload.transactions);

  return {
    cursor: payload.cursor,
    categories: removeTombstonedRows(categories, payload.tombstones, "category"),
    financialAccounts: removeTombstonedRows(
      financialAccounts,
      payload.tombstones,
      "financialAccount"
    ),
    transactions: removeTombstonedRows(transactions, payload.tombstones, "transaction"),
  };
}

function upsertById<Row extends { readonly id: string }>(
  existing: readonly Row[],
  incoming: readonly Row[]
): readonly Row[] {
  return [...new Map([...existing, ...incoming].map((row) => [row.id, row])).values()];
}

function removeTombstonedRows<Row extends { readonly id: string }>(
  rows: readonly Row[],
  tombstones: readonly CloudLedgerTombstone[],
  recordType: CloudLedgerTombstoneRecordType
): readonly Row[] {
  const tombstoneIds = new Set(
    tombstones
      .filter((tombstone) => tombstone.recordType === recordType)
      .map((tombstone) => tombstone.recordId)
  );
  return rows.filter((row) => !tombstoneIds.has(row.id));
}
