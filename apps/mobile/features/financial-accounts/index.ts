export { buildDefaultFinancialAccountId } from "./lib/default-account";
export {
  type FinancialAccountIdentifierRow,
  getFinancialAccountIdentifierById,
  getFinancialAccountIdentifiersForAccount,
  getFinancialAccountIdentifiersForUser,
  saveFinancialAccountIdentifier,
  saveFinancialAccountIdentifierInTransaction,
  upsertFinancialAccountIdentifier,
} from "./lib/identifiers-repository";
export {
  createFinancialAccountManagementService,
  MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
} from "./lib/management-service";
export {
  getOpeningBalanceById,
  getOpeningBalanceForAccount,
  type OpeningBalanceRow,
  saveOpeningBalance,
  upsertOpeningBalance,
} from "./lib/opening-balances-repository";
export {
  ensureDefaultFinancialAccount,
  type FinancialAccountRow,
  getDefaultFinancialAccountForUser,
  getFinancialAccountById,
  getFinancialAccountsForUser,
  saveFinancialAccount,
  upsertFinancialAccount,
} from "./lib/repository";
export { type FinancialAccountKind, financialAccountKindSchema } from "./schema";
export { tryEnsureDefaultFinancialAccount } from "./services/try-ensure-default-account";
