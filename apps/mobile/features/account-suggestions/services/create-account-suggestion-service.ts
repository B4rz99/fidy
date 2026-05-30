import {
  getCaptureEvidenceRowsForScopeValue,
  getRepeatedCaptureEvidenceForUser,
} from "@/features/capture-evidence/public";
import {
  type FinancialAccountIdentifierRow,
  type FinancialAccountKind,
  getFinancialAccountIdentifiersForUser,
  saveFinancialAccount,
  saveFinancialAccountIdentifierInTransaction,
} from "@/features/financial-accounts/public";
import { isActiveTransactionRow } from "@/features/transactions/query.public";
import { getTransactionById } from "@/features/transactions/query.public";
import { updateTransactionAccountAttribution } from "@/infrastructure/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import {
  generateAccountSuggestionDismissalId,
  generateFinancialAccountId,
  generateFinancialAccountIdentifierId,
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
  readonly saveFinancialAccount?: typeof saveFinancialAccount;
  readonly saveFinancialAccountIdentifierInTransaction?: typeof saveFinancialAccountIdentifierInTransaction;
  readonly getTransactionById?: typeof getTransactionById;
  readonly updateTransactionAccountAttribution?: typeof updateTransactionAccountAttribution;
  readonly now?: () => IsoDateTime;
  readonly createAccountId?: () => FinancialAccountId;
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

type CreateSuggestedAccountInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly suggestion: AccountCreationSuggestion;
  readonly name: string;
  readonly kind: FinancialAccountKind;
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
  saveFinancialAccount: persistFinancialAccount = saveFinancialAccount,
  saveFinancialAccountIdentifierInTransaction:
    persistFinancialAccountIdentifierInTransaction = saveFinancialAccountIdentifierInTransaction,
  getTransactionById: loadTransactionById = getTransactionById,
  updateTransactionAccountAttribution:
    persistTransactionAttribution = updateTransactionAccountAttribution,
  now = () => toIsoDateTime(new Date()),
  createAccountId = generateFinancialAccountId,
  createDismissalId = generateAccountSuggestionDismissalId,
  createIdentifierId = generateFinancialAccountIdentifierId,
}: CreateAccountSuggestionServiceDeps = {}) {
  function acceptSuggestionWithTimestamp({
    db,
    userId,
    accountId,
    suggestion,
    updatedAt,
  }: AcceptSuggestionInput & { readonly updatedAt: IsoDateTime }): AcceptSuggestionResult {
    persistFinancialAccountIdentifierInTransaction(db, {
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
        loadCaptureEvidenceRowsForScopeValue(db, {
          userId,
          scope: suggestion.scope,
          value: suggestion.value,
        }).flatMap((row) => {
          const transactionId = row.transactionId;
          if (transactionId == null) return [];
          const transaction = loadTransactionById(db, transactionId);
          return transaction?.userId === userId &&
            isActiveTransactionRow(transaction) &&
            transaction.accountAttributionState === "unresolved"
            ? [transactionId]
            : [];
        })
      )
    );

    reprocessedTransactionIds.forEach((transactionId) => {
      persistTransactionAttribution(db, {
        userId,
        transactionId,
        accountId,
        accountAttributionState: "inferred",
        updatedAt,
      });
    });

    return {
      accountId,
      identifierScope: suggestion.scope,
      identifierValue: suggestion.value,
      reprocessedTransactionIds,
    };
  }

  return {
    listSuggestions(input: ListSuggestionsInput): readonly AccountCreationSuggestion[] {
      const minimumOccurrences = input.minimumOccurrences ?? 2;
      const suggestions = filterDismissedSuggestions(
        filterAlreadyLinkedSuggestions(
          deriveAccountSuggestions(
            loadRepeatedCaptureEvidenceForUser(input.db, input.userId, minimumOccurrences)
          ),
          loadFinancialAccountIdentifiersForUser(input.db, input.userId)
        ),
        loadAccountSuggestionDismissalsForUser(input.db, input.userId)
      );

      return applyLimit(suggestions, input.limit);
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
      return db.transaction((tx) =>
        acceptSuggestionWithTimestamp({
          db: tx,
          userId,
          accountId,
          suggestion,
          updatedAt: now(),
        })
      );
    },

    createSuggestedAccount(input: CreateSuggestedAccountInput): AcceptSuggestionResult {
      const updatedAt = now();
      const accountId = createAccountId();

      return input.db.transaction((tx) => {
        persistFinancialAccount(tx, {
          id: accountId,
          userId: input.userId,
          name: input.name,
          kind: input.kind,
          isDefault: false,
          createdAt: updatedAt,
          updatedAt,
          deletedAt: null,
        });

        return acceptSuggestionWithTimestamp({
          db: tx,
          userId: input.userId,
          accountId,
          suggestion: input.suggestion,
          updatedAt,
        });
      });
    },
  };
}
