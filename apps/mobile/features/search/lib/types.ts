import type { StoredTransaction } from "@/features/transactions/query.public";
import type { TransferSource } from "@/local-ledger/domain/public";
import type { CopAmount, FinancialAccountId, TransferId, UserId } from "@/shared/types/branded";

export type SearchFilters = {
  readonly query: string;
  readonly categoryIds: readonly string[];
  readonly dateFrom: string | null; // ISO "YYYY-MM-DD"
  readonly dateTo: string | null;
  readonly amountMin: number | null;
  readonly amountMax: number | null;
  readonly type: "all" | "expense" | "income" | "transfer";
};

export type SearchSummary = {
  readonly count: number;
  readonly total: number;
};

export type SearchTransferSide =
  | {
      readonly kind: "account";
      readonly accountId: FinancialAccountId;
    }
  | {
      readonly kind: "external";
      readonly label: string;
    };

export type SearchTransfer = {
  readonly id: TransferId;
  readonly userId: UserId;
  readonly amount: CopAmount;
  readonly fromSide: SearchTransferSide;
  readonly toSide: SearchTransferSide;
  readonly description: string;
  readonly date: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly source: TransferSource;
};

export type SearchResult =
  | {
      readonly kind: "transaction";
      readonly id: StoredTransaction["id"];
      readonly date: Date;
      readonly updatedAt: Date;
      readonly transaction: StoredTransaction;
    }
  | {
      readonly kind: "transfer";
      readonly id: SearchTransfer["id"];
      readonly date: Date;
      readonly updatedAt: Date;
      readonly transfer: SearchTransfer;
      readonly accountNames: Readonly<Record<string, string>>;
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
