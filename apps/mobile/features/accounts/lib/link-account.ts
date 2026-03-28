import type { AccountId } from "@/shared/types/branded";
import type { BankKey, StoredAccount } from "../schema";
import { extractCardIdentifier } from "./extract-identifier";
import { resolveAccountId } from "./resolve-account";

type LinkInput = {
  readonly bankKey: BankKey | null;
  readonly notificationText: string;
  readonly userAccounts: readonly Pick<
    StoredAccount,
    "id" | "bankKey" | "identifiers" | "isDefault"
  >[];
  readonly defaultAccountId: AccountId;
};

type LinkResult = {
  readonly accountId: AccountId;
  readonly needsReview: boolean;
};

export function linkTransactionToAccount(input: LinkInput): LinkResult {
  const { bankKey, notificationText, userAccounts, defaultAccountId } = input;

  if (bankKey === null) {
    return { accountId: defaultAccountId, needsReview: true };
  }

  const candidates = userAccounts.filter((a) => a.bankKey === bankKey);

  if (candidates.length === 0) {
    return { accountId: defaultAccountId, needsReview: true };
  }

  if (candidates.length === 1) {
    return { accountId: candidates[0].id, needsReview: false };
  }

  const extractedIdentifier = extractCardIdentifier(notificationText);
  const resolved = resolveAccountId(candidates, extractedIdentifier);

  if (resolved === "review") {
    return { accountId: defaultAccountId, needsReview: true };
  }

  return { accountId: resolved, needsReview: false };
}
