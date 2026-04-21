import {
  type AccountCreationSuggestion,
  createAccountSuggestionFingerprint,
} from "@/features/account-suggestions/lib/derive-account-suggestions";
import { buildSuggestedFinancialAccountDraft } from "@/features/account-suggestions/lib/presentation";
import { createAccountSuggestionService } from "@/features/account-suggestions/services/create-account-suggestion-service";
import { getCaptureEvidenceRowsForTransaction } from "@/features/capture-evidence/lib/repository";
import {
  type FinancialAccountRow,
  getFinancialAccountsForUser,
} from "@/features/financial-accounts/lib/repository";
import { toStoredTransaction } from "@/features/transactions/lib/build-transaction";
import {
  getAllTransactions,
  getTransactionById as loadTransactionById,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import { enqueueSync } from "@/shared/db/enqueue-sync";
import { toIsoDateTime } from "@/shared/lib/format-date";
import { generateSyncQueueId } from "@/shared/lib/generate-id";
import type {
  FinancialAccountId,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type AttributionReviewItem = {
  readonly transaction: ReturnType<typeof toStoredTransaction>;
  readonly currentAccount: FinancialAccountRow | null;
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

type ConfirmSuggestedOwnerResult =
  | {
      readonly success: true;
      readonly accountId: FinancialAccountId;
      readonly suggestionFingerprint: string;
    }
  | {
      readonly success: false;
      readonly error: "reviewItemNotFound" | "suggestedOwnerUnavailable";
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
  if (kind === "wallet") {
    return 4;
  }
  return kind === "checking" ? 2 : 0;
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
): AttributionReviewItem {
  const suggestedAccount = suggestion ? getSuggestedAccount(accounts, suggestion) : null;

  return {
    transaction: toStoredTransaction(transactionRow),
    currentAccount: accounts.find((account) => account.id === transactionRow.accountId) ?? null,
    suggestedAccount,
    suggestion,
    evidenceLabel: suggestion
      ? buildSuggestedFinancialAccountDraft(suggestion).evidenceLabel
      : null,
  };
}

function confirmSuggestedOwnerInTransaction(input: {
  readonly tx: AnyDb;
  readonly transactionId: TransactionId;
  readonly userId: UserId;
  readonly suggestedAccount: FinancialAccountRow;
  readonly suggestion: AccountCreationSuggestion;
  readonly updatedAt: IsoDateTime;
  readonly getTransactionById: typeof loadTransactionById;
  readonly accountSuggestionService: ReturnType<typeof createAccountSuggestionService>;
}): ConfirmSuggestedOwnerResult {
  const currentTransaction = input.getTransactionById(input.tx, input.transactionId);
  if (!currentTransaction) {
    return { success: false, error: "reviewItemNotFound" };
  }

  input.accountSuggestionService.acceptSuggestion({
    db: input.tx,
    userId: input.userId,
    accountId: input.suggestedAccount.id,
    suggestion: input.suggestion,
  });

  upsertTransaction(input.tx, {
    ...currentTransaction,
    accountId: input.suggestedAccount.id,
    accountAttributionState: "confirmed",
    updatedAt: input.updatedAt,
  });

  enqueueSync(input.tx, {
    id: generateSyncQueueId(),
    tableName: "transactions",
    rowId: input.transactionId,
    operation: "update",
    createdAt: input.updatedAt,
  });

  return {
    success: true,
    accountId: input.suggestedAccount.id,
    suggestionFingerprint: input.suggestion.fingerprint,
  };
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

    return getAllTransactions(db, userId)
      .filter((transaction) => transaction.accountAttributionState === "unresolved")
      .map((transaction) =>
        toReviewItem(
          transaction,
          accounts,
          getBestMatchingSuggestion({
            suggestions,
            transactionId: transaction.id,
            db,
            userId,
          })
        )
      );
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
