import type { AccountCreationSuggestion } from "@/features/account-suggestions/public";
import type { createAccountSuggestionService } from "@/features/account-suggestions/public";
import type { FinancialAccountRow } from "@/features/financial-accounts/write.public";
import { type getTransactionById as loadTransactionById } from "@/features/transactions/query.public";
import { updateTransactionAccountAttribution } from "@/infrastructure/local-ledger/public";
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

  updateTransactionAccountAttribution(tx, {
    transactionId: currentTransaction.id,
    userId,
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
