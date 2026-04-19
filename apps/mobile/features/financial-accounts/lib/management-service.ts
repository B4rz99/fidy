import type { AnyDb } from "@/shared/db";
import {
  generateFinancialAccountId,
  generateFinancialAccountIdentifierId,
  generateOpeningBalanceId,
  toIsoDateTime,
} from "@/shared/lib";
import type {
  CopAmount,
  FinancialAccountId,
  FinancialAccountIdentifierId,
  IsoDate,
  IsoDateTime,
  OpeningBalanceId,
  UserId,
} from "@/shared/types/branded";
import type { FinancialAccountKind } from "../schema";
import {
  type FinancialAccountIdentifierRow,
  getFinancialAccountIdentifiersForAccount,
  saveFinancialAccountIdentifierInTransaction,
} from "./identifiers-repository";
import {
  getOpeningBalanceForAccount,
  type OpeningBalanceRow,
  saveOpeningBalance,
} from "./opening-balances-repository";
import {
  type FinancialAccountRow,
  getFinancialAccountById,
  saveFinancialAccount,
} from "./repository";

export const MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE = "manual:account_hint";

type CreateFinancialAccountManagementServiceDeps = {
  readonly now?: () => IsoDateTime;
  readonly createAccountId?: () => FinancialAccountId;
  readonly createOpeningBalanceId?: () => OpeningBalanceId;
  readonly createIdentifierId?: () => FinancialAccountIdentifierId;
};

type CreateAccountInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly name: string;
  readonly kind: FinancialAccountKind;
  readonly openingBalanceAmount: CopAmount | null;
  readonly openingBalanceEffectiveDate: IsoDate | null;
  readonly manualIdentifierValue: string | null;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
};

type UpdateAccountInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly name: string;
  readonly kind: FinancialAccountKind;
  readonly openingBalanceAmount: CopAmount | null;
  readonly openingBalanceEffectiveDate: IsoDate | null;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
};

type AddManualIdentifierInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly value: string;
};

type GetAccountDetailsInput = {
  readonly db: AnyDb;
  readonly accountId: FinancialAccountId;
};

type CreateAccountResult = {
  readonly account: FinancialAccountRow;
};

type FinancialAccountDetails = {
  readonly account: FinancialAccountRow;
  readonly openingBalance: OpeningBalanceRow | null;
  readonly identifiers: readonly FinancialAccountIdentifierRow[];
  readonly hasBillingProfileGap: boolean;
};

function trimOrNull(value: string | null) {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function hasBillingProfileGap(
  account: Pick<FinancialAccountRow, "kind" | "statementClosingDay" | "paymentDueDay">
) {
  return (
    account.kind === "credit_card" &&
    (account.statementClosingDay == null || account.paymentDueDay == null)
  );
}

function normalizeOpeningBalance(
  amount: CopAmount | null,
  effectiveDate: IsoDate | null
): Pick<OpeningBalanceRow, "amount" | "effectiveDate"> | null {
  const hasOpeningBalance = amount != null && effectiveDate != null;
  const hasPartialOpeningBalance = amount != null || effectiveDate != null;

  if (hasPartialOpeningBalance && !hasOpeningBalance) {
    throw new Error("opening balance requires both amount and effective date");
  }

  return hasOpeningBalance
    ? {
        amount,
        effectiveDate,
      }
    : null;
}

function normalizeBillingDay(value: number | null, label: string) {
  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new Error(`${label} must be an integer between 1 and 31`);
  }

  return value;
}

function normalizeBillingProfile(
  kind: FinancialAccountKind,
  statementClosingDay: number | null,
  paymentDueDay: number | null
) {
  if (kind !== "credit_card") {
    return {
      statementClosingDay: null,
      paymentDueDay: null,
    };
  }

  return {
    statementClosingDay: normalizeBillingDay(statementClosingDay, "statementClosingDay"),
    paymentDueDay: normalizeBillingDay(paymentDueDay, "paymentDueDay"),
  };
}

function assertOwnedFinancialAccount(account: FinancialAccountRow | null, userId: UserId) {
  if (!account || account.deletedAt != null || account.userId !== userId) {
    throw new Error("financial account not found");
  }

  return account;
}

export function createFinancialAccountManagementService({
  now = () => toIsoDateTime(new Date()),
  createAccountId = generateFinancialAccountId,
  createOpeningBalanceId = generateOpeningBalanceId,
  createIdentifierId = generateFinancialAccountIdentifierId,
}: CreateFinancialAccountManagementServiceDeps = {}) {
  const persistManualIdentifier = (
    db: AnyDb,
    userId: UserId,
    accountId: FinancialAccountId,
    value: string,
    updatedAt: IsoDateTime
  ) => {
    const normalizedIdentifierValue = trimOrNull(value);

    if (normalizedIdentifierValue == null) {
      return;
    }

    saveFinancialAccountIdentifierInTransaction(db, {
      id: createIdentifierId(),
      userId,
      accountId,
      scope: MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
      value: normalizedIdentifierValue,
      createdAt: updatedAt,
      updatedAt,
      deletedAt: null,
    });
  };

  const getAccountDetails = ({
    db,
    accountId,
  }: GetAccountDetailsInput): FinancialAccountDetails | null => {
    const account = getFinancialAccountById(db, accountId);

    if (!account || account.deletedAt != null) {
      return null;
    }

    return {
      account,
      openingBalance: getOpeningBalanceForAccount(db, accountId),
      identifiers: getFinancialAccountIdentifiersForAccount(db, accountId),
      hasBillingProfileGap: hasBillingProfileGap(account),
    };
  };

  return {
    getAccountDetails,
    createAccount({
      db,
      userId,
      name,
      kind,
      openingBalanceAmount,
      openingBalanceEffectiveDate,
      manualIdentifierValue,
      statementClosingDay,
      paymentDueDay,
    }: CreateAccountInput): CreateAccountResult {
      const createdAt = now();
      const normalizedName = name.trim();
      const normalizedBillingProfile = normalizeBillingProfile(
        kind,
        statementClosingDay,
        paymentDueDay
      );
      const normalizedOpeningBalance = normalizeOpeningBalance(
        openingBalanceAmount,
        openingBalanceEffectiveDate
      );

      if (normalizedName.length === 0) {
        throw new Error("financial account name is required");
      }

      const account = {
        id: createAccountId(),
        userId,
        name: normalizedName,
        kind,
        isDefault: false,
        statementClosingDay: normalizedBillingProfile.statementClosingDay,
        paymentDueDay: normalizedBillingProfile.paymentDueDay,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      } satisfies FinancialAccountRow;

      db.transaction((tx) => {
        saveFinancialAccount(tx, account);

        if (normalizedOpeningBalance != null) {
          saveOpeningBalance(tx, {
            id: createOpeningBalanceId(),
            userId,
            accountId: account.id,
            amount: normalizedOpeningBalance.amount,
            effectiveDate: normalizedOpeningBalance.effectiveDate,
            createdAt,
            updatedAt: createdAt,
            deletedAt: null,
          });
        }

        persistManualIdentifier(tx, userId, account.id, manualIdentifierValue ?? "", createdAt);
      });

      return { account };
    },

    updateAccount({
      db,
      userId,
      accountId,
      name,
      kind,
      openingBalanceAmount,
      openingBalanceEffectiveDate,
      statementClosingDay,
      paymentDueDay,
    }: UpdateAccountInput): CreateAccountResult {
      const updatedAt = now();
      const normalizedName = name.trim();
      const normalizedBillingProfile = normalizeBillingProfile(
        kind,
        statementClosingDay,
        paymentDueDay
      );
      const normalizedOpeningBalance = normalizeOpeningBalance(
        openingBalanceAmount,
        openingBalanceEffectiveDate
      );
      const existingAccount = assertOwnedFinancialAccount(
        getFinancialAccountById(db, accountId),
        userId
      );
      const existingOpeningBalance = getOpeningBalanceForAccount(db, accountId);

      if (normalizedName.length === 0) {
        throw new Error("financial account name is required");
      }

      const account = {
        ...existingAccount,
        name: normalizedName,
        kind,
        statementClosingDay: normalizedBillingProfile.statementClosingDay,
        paymentDueDay: normalizedBillingProfile.paymentDueDay,
        updatedAt,
        deletedAt: null,
      } satisfies FinancialAccountRow;

      db.transaction((tx) => {
        saveFinancialAccount(tx, account);

        if (normalizedOpeningBalance != null) {
          saveOpeningBalance(tx, {
            id: existingOpeningBalance?.id ?? createOpeningBalanceId(),
            userId,
            accountId,
            amount: normalizedOpeningBalance.amount,
            effectiveDate: normalizedOpeningBalance.effectiveDate,
            createdAt: existingOpeningBalance?.createdAt ?? updatedAt,
            updatedAt,
            deletedAt: null,
          });
          return;
        }

        if (existingOpeningBalance) {
          saveOpeningBalance(tx, {
            ...existingOpeningBalance,
            updatedAt,
            deletedAt: updatedAt,
          });
        }
      });

      return { account };
    },

    addManualIdentifier({ db, userId, accountId, value }: AddManualIdentifierInput) {
      const account = assertOwnedFinancialAccount(getFinancialAccountById(db, accountId), userId);
      const updatedAt = now();

      db.transaction((tx) => {
        persistManualIdentifier(tx, userId, account.id, value, updatedAt);
      });
    },
  };
}
