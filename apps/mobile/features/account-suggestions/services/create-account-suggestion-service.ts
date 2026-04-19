import {
  getCaptureEvidenceRowsForScopeValue,
  getRepeatedCaptureEvidenceForUser,
} from "@/features/capture-evidence";
import {
  type FinancialAccountIdentifierRow,
  getFinancialAccountIdentifiersForUser,
  saveFinancialAccountIdentifier,
} from "@/features/financial-accounts";
import { getTransactionById, upsertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  generateAccountSuggestionDismissalId,
  generateFinancialAccountIdentifierId,
  generateSyncQueueId,
  toIsoDateTime,
} from "@/shared/lib";
import type {
  AccountSuggestionDismissalId,
  FinancialAccountId,
  FinancialAccountIdentifierId,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import {
  type AccountCreationSuggestion,
  createAccountSuggestionFingerprint,
  deriveAccountSuggestions,
} from "../lib/derive-account-suggestions";
import {
  type AccountSuggestionDismissalRow,
  getAccountSuggestionDismissalsForUser,
  saveAccountSuggestionDismissal,
} from "../lib/dismissals-repository";

type CreateAccountSuggestionServiceDeps = {
  readonly getRepeatedCaptureEvidenceForUser?: typeof getRepeatedCaptureEvidenceForUser;
  readonly getCaptureEvidenceRowsForScopeValue?: typeof getCaptureEvidenceRowsForScopeValue;
  readonly getAccountSuggestionDismissalsForUser?: typeof getAccountSuggestionDismissalsForUser;
  readonly saveAccountSuggestionDismissal?: typeof saveAccountSuggestionDismissal;
  readonly getFinancialAccountIdentifiersForUser?: typeof getFinancialAccountIdentifiersForUser;
  readonly saveFinancialAccountIdentifier?: typeof saveFinancialAccountIdentifier;
  readonly getTransactionById?: typeof getTransactionById;
  readonly upsertTransaction?: typeof upsertTransaction;
  readonly enqueueSync?: typeof enqueueSync;
  readonly now?: () => IsoDateTime;
  readonly createDismissalId?: () => AccountSuggestionDismissalId;
  readonly createIdentifierId?: () => FinancialAccountIdentifierId;
};

type ListSuggestionsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly limit?: number;
  readonly minimumOccurrences?: number;
};

type DismissSuggestionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly suggestion: AccountCreationSuggestion;
};

type AcceptSuggestionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly suggestion: AccountCreationSuggestion;
};

type AcceptSuggestionResult = {
  readonly accountId: FinancialAccountId;
  readonly identifierScope: string;
  readonly identifierValue: string;
  readonly reprocessedTransactionIds: readonly TransactionId[];
};

function applyLimit<T>(rows: readonly T[], limit: number | undefined) {
  return typeof limit === "number" ? rows.slice(0, limit) : rows;
}

function filterAlreadyLinkedSuggestions(
  suggestions: readonly AccountCreationSuggestion[],
  identifiers: readonly FinancialAccountIdentifierRow[]
) {
  const linkedFingerprints = new Set(
    identifiers.map((row) => createAccountSuggestionFingerprint(row.scope, row.value))
  );

  return suggestions.filter((suggestion) => !linkedFingerprints.has(suggestion.fingerprint));
}

function filterDismissedSuggestions(
  suggestions: readonly AccountCreationSuggestion[],
  dismissals: readonly AccountSuggestionDismissalRow[]
) {
  const dismissalScoreByFingerprint = new Map(
    dismissals.map((row) => [
      createAccountSuggestionFingerprint(row.scope, row.value),
      row.dismissedScore,
    ])
  );

  return suggestions.filter((suggestion) => {
    const dismissedScore = dismissalScoreByFingerprint.get(suggestion.fingerprint);
    return dismissedScore == null || suggestion.confidenceScore > dismissedScore;
  });
}

export function createAccountSuggestionService({
  getRepeatedCaptureEvidenceForUser:
    loadRepeatedCaptureEvidenceForUser = getRepeatedCaptureEvidenceForUser,
  getCaptureEvidenceRowsForScopeValue:
    loadCaptureEvidenceRowsForScopeValue = getCaptureEvidenceRowsForScopeValue,
  getAccountSuggestionDismissalsForUser:
    loadAccountSuggestionDismissalsForUser = getAccountSuggestionDismissalsForUser,
  saveAccountSuggestionDismissal:
    persistAccountSuggestionDismissal = saveAccountSuggestionDismissal,
  getFinancialAccountIdentifiersForUser:
    loadFinancialAccountIdentifiersForUser = getFinancialAccountIdentifiersForUser,
  saveFinancialAccountIdentifier:
    persistFinancialAccountIdentifier = saveFinancialAccountIdentifier,
  getTransactionById: loadTransactionById = getTransactionById,
  upsertTransaction: persistTransaction = upsertTransaction,
  enqueueSync: enqueueSyncEntry = enqueueSync,
  now = () => toIsoDateTime(new Date()),
  createDismissalId = generateAccountSuggestionDismissalId,
  createIdentifierId = generateFinancialAccountIdentifierId,
}: CreateAccountSuggestionServiceDeps = {}) {
  return {
    listSuggestions({
      db,
      userId,
      limit,
      minimumOccurrences = 2,
    }: ListSuggestionsInput): readonly AccountCreationSuggestion[] {
      return applyLimit(
        filterDismissedSuggestions(
          filterAlreadyLinkedSuggestions(
            deriveAccountSuggestions(
              loadRepeatedCaptureEvidenceForUser(db, userId, minimumOccurrences)
            ),
            loadFinancialAccountIdentifiersForUser(db, userId)
          ),
          loadAccountSuggestionDismissalsForUser(db, userId)
        ),
        limit
      );
    },

    dismissSuggestion({ db, userId, suggestion }: DismissSuggestionInput) {
      const existingDismissal = loadAccountSuggestionDismissalsForUser(db, userId).find(
        (row) => row.scope === suggestion.scope && row.value === suggestion.value
      );
      const updatedAt = now();

      persistAccountSuggestionDismissal(db, {
        id: existingDismissal?.id ?? createDismissalId(),
        userId,
        scope: suggestion.scope,
        value: suggestion.value,
        dismissedScore: suggestion.confidenceScore,
        createdAt: existingDismissal?.createdAt ?? updatedAt,
        updatedAt,
        deletedAt: null,
      });
    },

    acceptSuggestion({
      db,
      userId,
      accountId,
      suggestion,
    }: AcceptSuggestionInput): AcceptSuggestionResult {
      const updatedAt = now();

      persistFinancialAccountIdentifier(db, {
        id: createIdentifierId(),
        userId,
        accountId,
        scope: suggestion.scope,
        value: suggestion.value,
        createdAt: updatedAt,
        updatedAt,
        deletedAt: null,
      });

      const reprocessedTransactionIds = Array.from(
        new Set(
          loadCaptureEvidenceRowsForScopeValue(db, userId, suggestion.scope, suggestion.value)
            .map((row) => row.transactionId)
            .filter((transactionId): transactionId is TransactionId => transactionId != null)
            .filter((transactionId) => {
              const transaction = loadTransactionById(db, transactionId);
              return (
                transaction?.userId === userId &&
                transaction.deletedAt == null &&
                transaction.accountAttributionState === "unresolved"
              );
            })
        )
      );

      reprocessedTransactionIds.forEach((transactionId) => {
        const transaction = loadTransactionById(db, transactionId);
        if (!transaction) {
          return;
        }

        persistTransaction(db, {
          ...transaction,
          accountId,
          accountAttributionState: "inferred",
          updatedAt,
        });

        enqueueSyncEntry(db, {
          id: generateSyncQueueId(),
          tableName: "transactions",
          rowId: transactionId,
          operation: "update",
          createdAt: updatedAt,
        });
      });

      return {
        accountId,
        identifierScope: suggestion.scope,
        identifierValue: suggestion.value,
        reprocessedTransactionIds,
      };
    },
  };
}
