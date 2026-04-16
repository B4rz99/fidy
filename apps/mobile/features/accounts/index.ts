export { ensureDefaultAccounts } from "./lib/bootstrap";
export {
  getAccountById,
  getAccountsBySystemKeys,
  getAccountsForUser,
  getActiveAccountsForUser,
  insertAccount,
  upsertAccount,
} from "./lib/repository";
export type { Account, AccountClass, AccountSubtype, AccountSystemKey } from "./schema";
export {
  accountClassSchema,
  accountSubtypeSchema,
  accountSystemKeySchema,
} from "./schema";
