import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/lib/default-account";
import type { FinancialAccountRow } from "@/features/financial-accounts/lib/repository";
import type { TransactionRow } from "@/features/transactions/lib/repository";
import type { TransferRow } from "@/features/transfers/lib/repository";
import { getBuiltInCategoryId } from "@/shared/categories";
import {
  generateFinancialAccountId,
  generateTransactionId,
  generateTransferId,
  toIsoDate,
  toIsoDateTime,
} from "@/shared/lib";
import {
  requireCopAmount,
  requireFinancialAccountId,
  requireUserId,
} from "@/shared/types/assertions";
import type { LocalQaProfile, LocalQaSession } from "../local-session";

type LocalQaSeed = {
  readonly session: LocalQaSession;
  readonly financialAccounts: readonly FinancialAccountRow[];
  readonly transactions: readonly TransactionRow[];
  readonly transfers: readonly TransferRow[];
};

function getDisplayName(profile: LocalQaProfile): string {
  if (profile === "transfer-ready") return "Local QA Transfer Ready";
  if (profile === "transfer-conflict") return "Local QA Transfer Conflict";
  if (profile === "two-accounts") return "Local QA Two Accounts";
  if (profile === "empty") return "Local QA Empty";
  return "Local QA";
}

function getSessionForProfile(profile: LocalQaProfile): LocalQaSession {
  const userId = requireUserId(`qa-local-${profile}`);
  const displayName = getDisplayName(profile);

  return {
    userId,
    profile,
    onboardingComplete: profile !== "empty",
    displayName,
    email: `local-qa+${profile}@fidy.dev`,
  };
}

function buildAccounts(
  userId: LocalQaSession["userId"],
  now: Date,
  profile: LocalQaProfile
): readonly FinancialAccountRow[] {
  if (profile === "empty") return [];

  const createdAt = toIsoDateTime(now);
  const cashAccount = {
    id: buildDefaultFinancialAccountId(userId),
    userId,
    name: "Cash",
    kind: "cash",
    isDefault: true,
    statementClosingDay: null,
    paymentDueDay: null,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  } satisfies FinancialAccountRow;

  if (profile === "default") {
    return [cashAccount];
  }

  const bankAccount = {
    id: requireFinancialAccountId(`fa-bancolombia-${userId}`),
    userId,
    name: "Bancolombia",
    kind: "checking",
    isDefault: false,
    statementClosingDay: null,
    paymentDueDay: null,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  } satisfies FinancialAccountRow;

  return [cashAccount, bankAccount];
}

function buildTransactions(
  userId: LocalQaSession["userId"],
  now: Date,
  accounts: readonly FinancialAccountRow[],
  profile: LocalQaProfile
): readonly TransactionRow[] {
  if (profile !== "transfer-ready") return [];

  const defaultAccountId = buildDefaultFinancialAccountId(userId);
  const bankAccountId = accounts[1]?.id ?? defaultAccountId;

  return [
    {
      id: generateTransactionId(),
      userId,
      type: "income",
      amount: requireCopAmount(2_800_000),
      categoryId: getBuiltInCategoryId("other"),
      description: "Salary",
      date: toIsoDate(new Date("2026-04-17T00:00:00.000Z")),
      accountId: bankAccountId,
      accountAttributionState: "confirmed",
      createdAt: toIsoDateTime(new Date("2026-04-17T13:00:00.000Z")),
      updatedAt: toIsoDateTime(new Date("2026-04-17T13:00:00.000Z")),
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(84_000),
      categoryId: getBuiltInCategoryId("food"),
      description: "Groceries",
      date: toIsoDate(new Date("2026-04-18T00:00:00.000Z")),
      accountId: defaultAccountId,
      accountAttributionState: "confirmed",
      createdAt: toIsoDateTime(new Date("2026-04-18T12:00:00.000Z")),
      updatedAt: toIsoDateTime(new Date("2026-04-18T12:00:00.000Z")),
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(42_000),
      categoryId: getBuiltInCategoryId("transport"),
      description: "Cab",
      date: toIsoDate(now),
      accountId: defaultAccountId,
      accountAttributionState: "confirmed",
      createdAt: toIsoDateTime(new Date("2026-04-19T14:00:00.000Z")),
      updatedAt: toIsoDateTime(new Date("2026-04-19T14:00:00.000Z")),
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
  ];
}

function buildTransfers(
  userId: LocalQaSession["userId"],
  now: Date,
  accounts: readonly FinancialAccountRow[],
  profile: LocalQaProfile
): readonly TransferRow[] {
  if (profile !== "transfer-ready") return [];

  return [
    {
      id: generateTransferId(),
      userId,
      amount: requireCopAmount(300_000),
      fromAccountId: buildDefaultFinancialAccountId(userId),
      toAccountId: accounts[1]?.id ?? generateFinancialAccountId(),
      fromExternalLabel: null,
      toExternalLabel: null,
      description: "Move to bank",
      date: toIsoDate(now),
      createdAt: toIsoDateTime(new Date("2026-04-19T15:00:00.000Z")),
      updatedAt: toIsoDateTime(new Date("2026-04-19T15:00:00.000Z")),
      voidedAt: null,
    },
  ];
}

export function buildLocalQaSeed(profile: LocalQaProfile, now: Date = new Date()): LocalQaSeed {
  const session = getSessionForProfile(profile);
  const financialAccounts = buildAccounts(session.userId, now, profile);

  return {
    session,
    financialAccounts,
    transactions: buildTransactions(session.userId, now, financialAccounts, profile),
    transfers: buildTransfers(session.userId, now, financialAccounts, profile),
  };
}
