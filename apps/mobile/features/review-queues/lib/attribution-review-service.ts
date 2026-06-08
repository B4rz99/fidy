import {
  type AccountCreationSuggestion,
  createAccountSuggestionFingerprint,
} from "@/features/account-suggestions/public";
import { buildSuggestedFinancialAccountDraft } from "@/features/account-suggestions/public";
import { createAccountSuggestionService } from "@/features/account-suggestions/public";
import { getCaptureEvidenceRowsForTransaction } from "@/features/capture-evidence/query.public";
import {
  type FinancialAccountRow,
  getFinancialAccountsForUser,
} from "@/features/financial-accounts/query.public";
import { toStoredTransaction } from "@/features/transactions/query.public";
import {
  getAllTransactions,
  getTransactionById as loadTransactionById,
} from "@/features/transactions/query.public";
import type { AnyDb } from "@/shared/db/client";
import { toIsoDateTime } from "@/shared/lib/format-date";
import type { IsoDateTime, TransactionId, UserId } from "@/shared/types/branded";
import {
  type ConfirmSuggestedOwnerResult,
  confirmSuggestedOwnerInTransaction,
} from "./attribution-review-confirmation";

export type AttributionReviewItem = {
  readonly transaction: ReturnType<typeof toStoredTransaction>;
  readonly currentAccount: FinancialAccountRow;
  readonly suggestedAccount: FinancialAccountRow | null;
  readonly suggestion: AccountCreationSuggestion | null;
  readonly evidenceLabel: string | null;
};

type ListQueueItemsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
};

type ConfirmSuggestedOwnerInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly transactionId: TransactionId;
};

type CreateAttributionReviewServiceDeps = {
  readonly now?: () => IsoDateTime;
  readonly getTransactionById?: typeof loadTransactionById;
};

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreCardHintKind(kind: FinancialAccountRow["kind"]) {
  return kind === "credit_card" ? 5 : 0;
}

function scoreLast4Kind(kind: FinancialAccountRow["kind"]) {
  if (kind === "credit_card") {
    return 4;
  }
  return kind === "checking" ? 1 : 0;
}

function scoreAccountHintKind(kind: FinancialAccountRow["kind"]) {
  return (
    {
      wallet: 4,
      checking: 2,
    }[kind] ?? 0
  );
}

function getSuggestedKindScore(
  account: FinancialAccountRow,
  suggestion: AccountCreationSuggestion
) {
  if (suggestion.evidenceType === "card_hint") {
    return scoreCardHintKind(account.kind);
  }
  if (suggestion.evidenceType === "last4") {
    return scoreLast4Kind(account.kind);
  }
  return scoreAccountHintKind(account.kind);
}

function scoreSuggestedAccount(
  account: FinancialAccountRow,
  suggestion: AccountCreationSuggestion
) {
  const normalizedName = normalizeSearchText(account.name);
  const normalizedSource = normalizeSearchText(suggestion.sourceFamily);
  const normalizedEvidence = normalizeSearchText(suggestion.value);
  const kindScore = getSuggestedKindScore(account, suggestion);
  const sourceScore = normalizedName.includes(normalizedSource) ? 2 : 0;
  const evidenceScore = normalizedName.includes(normalizedEvidence) ? 1 : 0;
  const defaultPenalty = account.isDefault ? -1 : 0;

  return kindScore + sourceScore + evidenceScore + defaultPenalty;
}

type ScoredSuggestedAccount = {
  readonly account: FinancialAccountRow;
  readonly score: number;
};

function compareSuggestedAccounts(left: ScoredSuggestedAccount, right: ScoredSuggestedAccount) {
  return (
    right.score - left.score ||
    Number(left.account.isDefault) - Number(right.account.isDefault) ||
    left.account.name.localeCompare(right.account.name)
  );
}

function getSuggestedAccount(
  accounts: readonly FinancialAccountRow[],
  suggestion: AccountCreationSuggestion
) {
  return (
    Array.from(accounts)
      .map((account) => ({
        account,
        score: scoreSuggestedAccount(account, suggestion),
      }))
      .sort(compareSuggestedAccounts)
      .find((item) => item.score > 0)?.account ?? null
  );
}

function getBestMatchingSuggestion(input: {
  readonly suggestions: readonly AccountCreationSuggestion[];
  readonly transactionId: TransactionId;
  readonly db: AnyDb;
  readonly userId: UserId;
}) {
  const evidenceFingerprints = new Set(
    getCaptureEvidenceRowsForTransaction(input.db, input.userId, input.transactionId).map((row) =>
      createAccountSuggestionFingerprint(row.scope, row.value)
    )
  );

  return (
    input.suggestions.find((suggestion) => evidenceFingerprints.has(suggestion.fingerprint)) ?? null
  );
}

function toReviewItem(
  transactionRow: ReturnType<typeof getAllTransactions>[number],
  accounts: readonly FinancialAccountRow[],
  suggestion: AccountCreationSuggestion | null
): AttributionReviewItem | null {
  const currentAccount = findFinancialAccountById(accounts, transactionRow.accountId);
  if (!currentAccount) {
    return null;
  }

  const suggestedAccount = suggestion ? getSuggestedAccount(accounts, suggestion) : null;

  return {
    transaction: toStoredTransaction(transactionRow),
    currentAccount,
    suggestedAccount,
    suggestion,
    evidenceLabel: suggestion
      ? buildSuggestedFinancialAccountDraft(suggestion).evidenceLabel
      : null,
  };
}

function findFinancialAccountById(
  accounts: readonly FinancialAccountRow[],
  accountId: ReturnType<typeof getAllTransactions>[number]["accountId"]
) {
  return accounts.find((account) => account.id === accountId) ?? null;
}

export function createAttributionReviewService({
  now = () => toIsoDateTime(new Date()),
  getTransactionById = loadTransactionById,
}: CreateAttributionReviewServiceDeps = {}) {
  const accountSuggestionService = createAccountSuggestionService({ now });

  const listQueueItems = ({
    db,
    userId,
  }: ListQueueItemsInput): readonly AttributionReviewItem[] => {
    const accounts = getFinancialAccountsForUser(db, userId);
    const suggestions = accountSuggestionService.listSuggestions({ db, userId });

    return getAllTransactions(db, userId).flatMap((transaction) => {
      if (transaction.accountAttributionState !== "unresolved") {
        return [];
      }

      const reviewItem = toReviewItem(
        transaction,
        accounts,
        getBestMatchingSuggestion({
          suggestions,
          transactionId: transaction.id,
          db,
          userId,
        })
      );

      return reviewItem ? [reviewItem] : [];
    });
  };

  const getReviewItem = ({
    db,
    userId,
    transactionId,
  }: ListQueueItemsInput & { transactionId: TransactionId }) =>
    listQueueItems({ db, userId }).find((item) => item.transaction.id === transactionId) ?? null;

  function confirmSuggestedOwner(input: ConfirmSuggestedOwnerInput): ConfirmSuggestedOwnerResult {
    const { db, userId, transactionId } = input;
    const item = getReviewItem({ db, userId, transactionId });

    if (!item) {
      return { success: false, error: "reviewItemNotFound" };
    }

    if (!item.suggestion || !item.suggestedAccount) {
      return { success: false, error: "suggestedOwnerUnavailable" };
    }

    const { suggestedAccount, suggestion } = item;
    const updatedAt = now();

    return db.transaction(
      (tx): ConfirmSuggestedOwnerResult =>
        confirmSuggestedOwnerInTransaction({
          tx,
          transactionId,
          userId,
          suggestion,
          updatedAt,
          suggestedAccount,
          getTransactionById,
          accountSuggestionService,
        })
    );
  }

  return {
    listQueueItems,

    getReviewItem,
    confirmSuggestedOwner,
  };
}
