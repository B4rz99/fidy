import type { AccountCreationSuggestion } from "@/features/account-suggestions/lib/derive-account-suggestions";
import type { createAccountSuggestionService } from "@/features/account-suggestions/services/create-account-suggestion-service";
import type { FinancialAccountRow } from "@/features/financial-accounts/lib/repository";
import {
  type getTransactionById as loadTransactionById,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import type {
  FinancialAccountId,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type ConfirmSuggestedOwnerResult =
  | {
      readonly success: true;
      readonly accountId: FinancialAccountId;
      readonly suggestionFingerprint: string;
    }
  | {
      readonly success: false;
      readonly error: "reviewItemNotFound" | "suggestedOwnerUnavailable";
    };

type ConfirmOwnerTxInput = {
  readonly tx: AnyDb;
  readonly transactionId: TransactionId;
  readonly userId: UserId;
  readonly suggestedAccount: FinancialAccountRow;
  readonly suggestion: AccountCreationSuggestion;
  readonly updatedAt: IsoDateTime;
  readonly getTransactionById: typeof loadTransactionById;
  readonly accountSuggestionService: ReturnType<typeof createAccountSuggestionService>;
};

type ApplyOwnerInput = Omit<ConfirmOwnerTxInput, "transactionId" | "getTransactionById">;
type TransactionRow = NonNullable<ReturnType<typeof loadTransactionById>>;

function applySuggestedOwnerConfirmation(
  input: ApplyOwnerInput,
  currentTransaction: TransactionRow
) {
  const { accountSuggestionService, suggestedAccount, suggestion, tx, updatedAt, userId } = input;
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

  return {
    success: true as const,
    accountId: suggestedAccount.id,
    suggestionFingerprint: suggestion.fingerprint,
  };
}

export function confirmSuggestedOwnerInTransaction(
  input: ConfirmOwnerTxInput
): ConfirmSuggestedOwnerResult {
  const currentTransaction = input.getTransactionById(input.tx, input.transactionId);
  return currentTransaction
    ? applySuggestedOwnerConfirmation(input, currentTransaction)
    : { success: false, error: "reviewItemNotFound" };
}
