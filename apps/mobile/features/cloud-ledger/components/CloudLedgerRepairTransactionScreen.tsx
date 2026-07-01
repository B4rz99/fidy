import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { useAvailableCategories } from "@/features/categories/hooks.public";
import {
  getFinancialAccountsForUser,
  tryEnsureDefaultFinancialAccount,
  type FinancialAccountRow,
} from "@/features/financial-accounts/public";
import { TransactionForm, type TransactionType } from "@/features/transactions/ui.public";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useMountEffect, useTranslation } from "@/shared/hooks";
import {
  clampDateToToday,
  parseDigitsToAmount,
  parseIsoDate,
  showErrorToast,
  toIsoDate,
  toIsoDateTime,
} from "@/shared/lib";
import { requireLedgerChangeId } from "@/shared/types/assertions";
import type {
  CategoryId,
  FinancialAccountId,
  IsoDateTime,
  LedgerChangeId,
  UserId,
} from "@/shared/types/branded";
import type { CloudLedgerCache, CloudLedgerTransaction } from "../cache";
import {
  getCloudLedgerOutbox,
  loadCloudLedgerRepairItems,
  resubmitCloudLedgerRepairTransactionChange,
  type CloudLedgerPendingAmendTransaction,
  type CloudLedgerPendingCreateTransaction,
  type CloudLedgerRepairItem,
} from "../outbox";
import { flushCloudLedgerOutboxForUser } from "../runtime-mutations.public";
import { getCloudLedgerRuntimeCache, setCloudLedgerRuntimeCache } from "../runtime.public";

type DigitsInput = string | ((currentDigits: string) => string);

type EditableRepairItem = CloudLedgerRepairItem & {
  readonly change: CloudLedgerPendingAmendTransaction | CloudLedgerPendingCreateTransaction;
};

type RepairTransactionDraft = {
  readonly accountId: FinancialAccountId | null;
  readonly categoryId: CategoryId | null;
  readonly date: Date;
  readonly description: string;
  readonly digits: string;
  readonly type: TransactionType;
};

const initialDraft: RepairTransactionDraft = {
  accountId: null,
  categoryId: null,
  date: new Date(),
  description: "",
  digits: "",
  type: "expense",
};

export function CloudLedgerRepairTransactionScreen() {
  const { changeId: routeChangeId } = useLocalSearchParams<{ changeId?: string }>();
  const { back, replace } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const categories = useAvailableCategories();
  const [accounts, setAccounts] = useState<readonly FinancialAccountRow[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [repairItem, setRepairItem] = useState<EditableRepairItem | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();
  const changeId = parseRepairChangeId(routeChangeId);

  useMountEffect(() => {
    if (userId === null || changeId === null) {
      back();
      return;
    }

    void loadRepairTransactionScreen({
      changeId,
      userId,
      onLoaded: ({ item, nextAccounts }) => {
        setRepairItem(item);
        setDraft(draftFromRepairItem(item));
        setAccounts(nextAccounts);
        setIsLoaded(true);
      },
      onMissing: back,
    }).catch(() => {
      showErrorToast(t("cloudLedger.repair.actionFailed"));
      back();
    });
  });

  const handleSave = () => {
    void guardedSave(async () => {
      if (userId === null || repairItem === null) {
        showErrorToast(t("cloudLedger.repair.actionFailed"));
        return;
      }
      const runtimeCache = getCloudLedgerRuntimeCache(userId);
      const expectedVersion = expectedVersionForRepairItem(repairItem, runtimeCache);
      const createdAt = toIsoDateTime(new Date());
      const transaction = transactionFromDraft({
        createdAt,
        draft,
        expectedVersion,
        repairItem,
      });
      if (transaction === null) {
        showErrorToast(t("cloudLedger.repair.actionFailed"));
        return;
      }
      try {
        setCloudLedgerRuntimeCache(
          userId,
          await resubmitCloudLedgerRepairTransactionChange({
            cache: runtimeCache,
            changeId: repairItem.id,
            createdAt,
            expectedVersion,
            outbox: getCloudLedgerOutbox(userId),
            transaction,
          })
        );
        await flushCloudLedgerOutboxForUser(userId);
        replace("/ledger-repair");
      } catch {
        showErrorToast(t("cloudLedger.repair.actionFailed"));
      }
    });
  };

  if (!isLoaded || repairItem === null) {
    return null;
  }

  return (
    <TransactionForm
      type={draft.type}
      digits={draft.digits}
      categories={categories}
      categoryId={draft.categoryId}
      accounts={accounts}
      accountId={draft.accountId}
      description={draft.description}
      date={draft.date}
      saveLabel={t("cloudLedger.repair.resubmitAction")}
      isSaving={isSaving}
      onTypeChange={(type) => setDraft((current) => ({ ...current, type }))}
      onDigitsChange={(digits) =>
        setDraft((current) => ({
          ...current,
          digits: resolveDigitsInput(current.digits, digits),
        }))
      }
      onCategoryChange={(categoryId) => setDraft((current) => ({ ...current, categoryId }))}
      onAccountChange={(accountId) => setDraft((current) => ({ ...current, accountId }))}
      onDescriptionChange={(description) => setDraft((current) => ({ ...current, description }))}
      onDateChange={(date) => setDraft((current) => ({ ...current, date }))}
      onClose={back}
      onSave={handleSave}
    />
  );
}

async function loadRepairTransactionScreen(input: {
  readonly changeId: LedgerChangeId;
  readonly onLoaded: (result: {
    readonly item: EditableRepairItem;
    readonly nextAccounts: readonly FinancialAccountRow[];
  }) => void;
  readonly onMissing: () => void;
  readonly userId: UserId;
}): Promise<void> {
  const item = (await loadCloudLedgerRepairItems(getCloudLedgerOutbox(input.userId))).find(
    (candidate) => candidate.id === input.changeId
  );
  if (item === undefined || !isEditableRepairItem(item)) {
    input.onMissing();
    return;
  }
  const db = tryGetDb(input.userId);
  if (db !== null) {
    tryEnsureDefaultFinancialAccount(db, input.userId);
  }
  input.onLoaded({
    item,
    nextAccounts: db === null ? [] : getFinancialAccountsForUser(db, input.userId),
  });
}

function isEditableRepairItem(item: CloudLedgerRepairItem): item is EditableRepairItem {
  return item.change.kind !== "deleteTransaction" && item.actions.includes("editAndResubmit");
}

function draftFromRepairItem(item: EditableRepairItem): RepairTransactionDraft {
  return {
    accountId: item.change.transaction.accountId,
    categoryId: item.change.transaction.categoryId,
    date: parseIsoDate(item.change.transaction.date),
    description: item.change.transaction.description ?? "",
    digits: String(item.change.transaction.amount),
    type: item.change.transaction.type,
  };
}

function transactionFromDraft(input: {
  readonly createdAt: IsoDateTime;
  readonly draft: RepairTransactionDraft;
  readonly expectedVersion?: number;
  readonly repairItem: EditableRepairItem;
}): CloudLedgerTransaction | null {
  const amount = parseDigitsToAmount(input.draft.digits);
  return input.draft.accountId === null || amount <= 0
    ? null
    : {
        id: input.repairItem.change.transaction.id,
        type: input.draft.type,
        amount,
        currency: "COP",
        categoryId: input.draft.categoryId,
        accountId: input.draft.accountId,
        description: normalizeDescription(input.draft.description),
        date: toIsoDate(clampDateToToday(input.draft.date)),
        version:
          input.repairItem.change.kind === "createTransaction"
            ? 1
            : (input.expectedVersion ?? input.repairItem.change.expectedVersion) + 1,
        updatedAt: input.createdAt,
      };
}

function expectedVersionForRepairItem(
  item: EditableRepairItem,
  cache: CloudLedgerCache
): number | undefined {
  return item.change.kind === "createTransaction"
    ? undefined
    : (item.acceptedTransactionVersion ??
        cache.transactions.find((transaction) => transaction.id === item.change.transaction.id)
          ?.version ??
        item.change.expectedVersion + 1);
}

function normalizeDescription(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function resolveDigitsInput(currentDigits: string, input: DigitsInput): string {
  return typeof input === "function" ? input(currentDigits) : input;
}

function parseRepairChangeId(value: string | undefined): LedgerChangeId | null {
  return value === undefined || value.trim().length === 0
    ? null
    : requireLedgerChangeId(value.trim());
}
