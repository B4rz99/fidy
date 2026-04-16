import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  generateAccountId,
  generateSyncQueueId,
  parseDigitsToAmount,
  toIsoDate,
  toIsoDateTime,
} from "@/shared/lib";
import type { AccountId, SyncQueueId, UserId } from "@/shared/types/branded";
import type { AccountSystemKey } from "../schema";
import { type AccountRow, getAccountsBySystemKeys, insertAccount } from "./repository";

type BootstrapDeps = {
  now?: () => Date;
  createId?: () => AccountId;
  createSyncId?: () => SyncQueueId;
};

type DefaultAccountTemplate = {
  readonly systemKey: AccountSystemKey;
  readonly accountClass: AccountRow["accountClass"];
  readonly accountSubtype: AccountRow["accountSubtype"];
  readonly name: string;
  readonly institution: string;
};

const DEFAULT_ACCOUNT_TEMPLATES = [
  {
    systemKey: "default_cash",
    accountClass: "asset",
    accountSubtype: "cash",
    name: "Cash",
    institution: "Fidy",
  },
  {
    systemKey: "default_digital_holding",
    accountClass: "asset",
    accountSubtype: "digital_holding",
    name: "Digital Holding",
    institution: "Fidy",
  },
] as const satisfies readonly DefaultAccountTemplate[];

const DEFAULT_SYSTEM_KEYS = DEFAULT_ACCOUNT_TEMPLATES.map((template) => template.systemKey);

const toDefaultAccountRow = (
  template: DefaultAccountTemplate,
  userId: UserId,
  now: Date,
  createId: () => AccountId
): AccountRow => ({
  id: createId(),
  userId,
  systemKey: template.systemKey,
  accountClass: template.accountClass,
  accountSubtype: template.accountSubtype,
  name: template.name,
  institution: template.institution,
  last4: null,
  baselineAmount: parseDigitsToAmount("0"),
  baselineDate: toIsoDate(now),
  creditLimit: null,
  closingDay: null,
  dueDay: null,
  archivedAt: null,
  createdAt: toIsoDateTime(now),
  updatedAt: toIsoDateTime(now),
});

export function ensureDefaultAccounts(db: AnyDb, userId: UserId, deps: BootstrapDeps = {}) {
  const now = deps.now?.() ?? new Date();
  const createId = deps.createId ?? generateAccountId;
  const createSyncId = deps.createSyncId ?? generateSyncQueueId;

  const existingSystemKeys = new Set(
    getAccountsBySystemKeys(db, userId, DEFAULT_SYSTEM_KEYS)
      .map((account) => account.systemKey)
      .filter((systemKey): systemKey is AccountSystemKey => systemKey != null)
  );

  const missingRows = DEFAULT_ACCOUNT_TEMPLATES.filter(
    (template) => !existingSystemKeys.has(template.systemKey)
  ).map((template) => toDefaultAccountRow(template, userId, now, createId));

  if (missingRows.length === 0) {
    return getAccountsBySystemKeys(db, userId, DEFAULT_SYSTEM_KEYS);
  }

  db.transaction((tx) => {
    missingRows.forEach((row) => {
      insertAccount(tx, row);
      enqueueSync(tx, {
        id: createSyncId(),
        tableName: "accounts",
        rowId: row.id,
        operation: "insert",
        createdAt: row.createdAt,
      });
    });
  });

  return getAccountsBySystemKeys(db, userId, DEFAULT_SYSTEM_KEYS);
}
