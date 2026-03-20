export type SearchFilters = {
  readonly query: string;
  readonly categoryIds: readonly string[];
  readonly dateFrom: string | null; // ISO "YYYY-MM-DD"
  readonly dateTo: string | null;
  readonly amountMin: number | null;
  readonly amountMax: number | null;
  readonly type: "all" | "expense" | "income";
};

export type SearchSummary = {
  readonly count: number;
  readonly total: number;
};

export const EMPTY_FILTERS: SearchFilters = {
  query: "",
  categoryIds: [],
  dateFrom: null,
  dateTo: null,
  amountMin: null,
  amountMax: null,
  type: "all",
};
