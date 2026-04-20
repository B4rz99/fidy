import type { AccountCreationSuggestion } from "@/features/account-suggestions";
import {
  buildSuggestedFinancialAccountDraft,
  createAccountSuggestionFingerprint,
} from "@/features/account-suggestions";
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

function scoreSuggestedAccount(
  account: FinancialAccountRow,
  suggestion: AccountCreationSuggestion
) {
  const normalizedName = normalizeSearchText(account.name);
  const normalizedSource = normalizeSearchText(suggestion.sourceFamily);
  const normalizedEvidence = normalizeSearchText(suggestion.value);
  const kindScore =
    suggestion.evidenceType === "card_hint"
      ? account.kind === "credit_card"
        ? 5
        : 0
      : suggestion.evidenceType === "last4"
        ? account.kind === "credit_card"
          ? 4
          : account.kind === "checking"
            ? 1
            : 0
        : account.kind === "wallet"
          ? 4
          : account.kind === "checking"
            ? 2
            : 0;
  const sourceScore = normalizedName.includes(normalizedSource) ? 2 : 0;
  const evidenceScore = normalizedName.includes(normalizedEvidence) ? 1 : 0;
  const defaultPenalty = account.isDefault ? -1 : 0;

  return kindScore + sourceScore + evidenceScore + defaultPenalty;
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
      .sort(
        (left, right) =>
          right.score - left.score ||
          Number(left.account.isDefault) - Number(right.account.isDefault) ||
          left.account.name.localeCompare(right.account.name)
      )
      .find((item) => item.score > 0)?.account ?? null
  );
}

function getBestMatchingSuggestion(
  suggestions: readonly AccountCreationSuggestion[],
  transactionId: TransactionId,
  db: AnyDb,
  userId: UserId
) {
  const evidenceFingerprints = new Set(
    getCaptureEvidenceRowsForTransaction(db, userId, transactionId).map((row) =>
      createAccountSuggestionFingerprint(row.scope, row.value)
    )
  );

  return suggestions.find((suggestion) => evidenceFingerprints.has(suggestion.fingerprint)) ?? null;
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
          getBestMatchingSuggestion(suggestions, transaction.id, db, userId)
        )
      );
  };

  const getReviewItem = ({
    db,
    userId,
    transactionId,
  }: ListQueueItemsInput & { transactionId: TransactionId }) =>
    listQueueItems({ db, userId }).find((item) => item.transaction.id === transactionId) ?? null;

  return {
    listQueueItems,

    getReviewItem,

    confirmSuggestedOwner({
      db,
      userId,
      transactionId,
    }: ConfirmSuggestedOwnerInput): ConfirmSuggestedOwnerResult {
      const item = getReviewItem({ db, userId, transactionId });

      if (!item) {
        return { success: false, error: "reviewItemNotFound" };
      }

      if (!item.suggestion || !item.suggestedAccount) {
        return { success: false, error: "suggestedOwnerUnavailable" };
      }

      const { suggestedAccount, suggestion } = item;
      const updatedAt = now();

      return db.transaction((tx): ConfirmSuggestedOwnerResult => {
        const currentTransaction = getTransactionById(tx, transactionId);

        if (!currentTransaction) {
          return { success: false, error: "reviewItemNotFound" };
        }

        accountSuggestionService.acceptSuggestion({
          db: tx,
          userId,
          accountId: suggestedAccount.id,
          suggestion,
        });

        upsertTransaction(tx, {
          ...currentTransaction,
          accountId: suggestedAccount.id,
          accountAttributionState: "confirmed",
          updatedAt,
        });

        enqueueSync(tx, {
          id: generateSyncQueueId(),
          tableName: "transactions",
          rowId: transactionId,
          operation: "update",
          createdAt: updatedAt,
        });

        return {
          success: true,
          accountId: suggestedAccount.id,
          suggestionFingerprint: suggestion.fingerprint,
        };
      });
    },
  };
}
