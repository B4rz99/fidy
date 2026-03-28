export {
  getAllBanks,
  getBankDefaults,
  isSingleAccountBank,
  resolveBankKeyFromDomain,
  resolveBankKeyFromPackage,
} from "./lib/bank-registry";
export { detectTransferCounterpart } from "./lib/detect-transfer";
export { extractCardIdentifier } from "./lib/extract-identifier";
export { linkTransactionToAccount } from "./lib/link-account";
export {
  getAccountById,
  getAccountsByBankKey,
  getAccountsByUser,
  getDefaultAccount,
  getReviewCount,
  getTransferCandidates,
  insertAccount,
  linkTransferPair,
  reassignTransactionAccount,
  setDefaultAccount,
  softDeleteAccount,
  toStoredAccount,
  updateAccount,
} from "./lib/repository";
export { resolveAccountId } from "./lib/resolve-account";
export type { AccountType, BankKey, CreateAccountInput, StoredAccount } from "./schema";
export { accountTypeSchema, bankKeySchema, createAccountSchema } from "./schema";
