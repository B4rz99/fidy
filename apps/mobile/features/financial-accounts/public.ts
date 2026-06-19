export { buildDefaultFinancialAccountId } from "./lib/default-account";
export {
  type FinancialAccountIdentifierRow,
  getFinancialAccountIdentifiersForAccount,
  getFinancialAccountIdentifiersForUser,
  saveFinancialAccountIdentifier,
  saveFinancialAccountIdentifierInTransaction,
  upsertFinancialAccountIdentifier,
} from "./lib/identifiers-repository";
export { createFinancialAccountManagementService } from "./lib/management-service";
export {
  getOpeningBalanceForAccount,
  type OpeningBalanceRow,
  saveOpeningBalance,
} from "./lib/opening-balances-repository";
export {
  ensureDefaultFinancialAccount,
  type FinancialAccountRow,
  getFinancialAccountById,
  getFinancialAccountsForUser,
  saveFinancialAccount,
  upsertFinancialAccount,
} from "./lib/repository";
export { type FinancialAccountKind, financialAccountKindSchema } from "./schema";
export { tryEnsureDefaultFinancialAccount } from "./services/try-ensure-default-account";
