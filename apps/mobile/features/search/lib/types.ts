export type SearchFilters = {
  readonly query: string;
  readonly categoryIds: readonly string[];
  readonly dateFrom: string | null; // ISO "YYYY-MM-DD"
  readonly dateTo: string | null;
  readonly amountMinCents: number | null;
  readonly amountMaxCents: number | null;
  readonly type: "all" | "expense" | "income";
};

export type SearchSummary = {
  readonly count: number;
  readonly totalCents: number;
};

export const EMPTY_FILTERS: SearchFilters = {
  query: "",
  categoryIds: [],
  dateFrom: null,
  dateTo: null,
  amountMinCents: null,
  amountMaxCents: null,
  type: "all",
};
