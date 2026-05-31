import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useReducer, useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import {
  type FinancialAccountRow,
  getFinancialAccountsForUser,
  tryEnsureDefaultFinancialAccount,
} from "@/features/financial-accounts";
import type { TransactionType } from "@/features/transactions";
import {
  deleteTransaction,
  getStoredTransactionById,
  TransactionForm,
  updateTransactionDirect,
} from "@/features/transactions";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useMountEffect, useTranslation } from "@/shared/hooks";
import { clampDateToToday, showErrorToast, waitForNavigationTransition } from "@/shared/lib";
import { requireTransactionId } from "@/shared/types/assertions";
import type { CategoryId, FinancialAccountId } from "@/shared/types/branded";

type EditTransactionDraft = {
  readonly accountId: FinancialAccountId | null;
  readonly categoryId: CategoryId | null;
  readonly date: Date;
  readonly description: string;
  readonly digits: string;
  readonly source: string;
  readonly type: TransactionType;
};

type DigitsInput = string | ((currentDigits: string) => string);

type EditTransactionDraftAction =
  | { readonly type: "update"; readonly update: Partial<EditTransactionDraft> }
  | { readonly type: "setDigits"; readonly digits: DigitsInput };

const initialDraft: EditTransactionDraft = {
  accountId: null,
  categoryId: null,
  date: new Date(),
  description: "",
  digits: "",
  source: "manual",
  type: "expense",
};

function updateDraft(
  draft: EditTransactionDraft,
  action: EditTransactionDraftAction
): EditTransactionDraft {
  if (action.type === "setDigits") {
    return { ...draft, digits: resolveDigitsInput(draft.digits, action.digits) };
  }

  return { ...draft, ...action.update };
}

function resolveDigitsInput(currentDigits: string, input: DigitsInput): string {
  return typeof input === "function" ? input(currentDigits) : input;
}

export default function EditTransactionScreen() {
  const { transactionId: routeTransactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const navigation = useNavigation();
  const { back, push } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  const [draft, setDraft] = useReducer(updateDraft, initialDraft);
  const [isLoaded, setIsLoaded] = useState(false);
  const [accounts, setAccounts] = useState<readonly FinancialAccountRow[]>([]);
  const transactionId =
    typeof routeTransactionId === "string" && routeTransactionId.trim().length > 0
      ? requireTransactionId(routeTransactionId.trim())
      : null;

  useMountEffect(() => {
    if (transactionId == null || !db || !userId) {
      back();
      return;
    }

    void (async () => {
      tryEnsureDefaultFinancialAccount(db, userId);
      setAccounts(getFinancialAccountsForUser(db, userId));
      const tx = getStoredTransactionById(db, userId, transactionId);
      if (!tx) {
        back();
        return;
      }

      setDraft({
        type: "update",
        update: {
          accountId: tx.accountId,
          categoryId: tx.categoryId,
          date: tx.date,
          description: tx.description,
          digits: String(tx.amount),
          source: tx.source ?? "manual",
          type: tx.type,
        },
      });
      setIsLoaded(true);
    })();
  });

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const dismissAndWait = () => {
    const pendingTransition = waitForNavigationTransition(navigation, {
      closing: true,
      fallbackMs: 2000,
    });
    back();
    return pendingTransition;
  };

  const handleSave = () => {
    void guardedSave(async () => {
      if (transactionId == null || !db || !userId) {
        showErrorToast(t("transactions.updateFailed"));
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await dismissAndWait();
      try {
        const result = await updateTransactionDirect({
          db,
          userId,
          id: transactionId,
          fields: {
            type: draft.type,
            digits: draft.digits,
            categoryId: draft.categoryId,
            accountId: draft.accountId,
            description: draft.description,
            date: clampDateToToday(draft.date),
          },
        });
        if (!result.success) {
          showErrorToast(t("transactions.updateFailed"));
        }
      } catch {
        showErrorToast(t("transactions.updateFailed"));
      }
    });
  };

  const handleDelete = () => {
    void guardedSave(async () => {
      if (transactionId == null || !db || !userId) {
        showErrorToast(t("transactions.deleteFailed"));
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await dismissAndWait();
      try {
        await deleteTransaction(db, userId, transactionId);
      } catch {
        showErrorToast(t("transactions.deleteFailed"));
      }
    });
  };

  if (!isLoaded) return null;

  return (
    <TransactionForm
      type={draft.type}
      digits={draft.digits}
      categoryId={draft.categoryId}
      accounts={accounts}
      accountId={draft.accountId}
      description={draft.description}
      date={draft.date}
      saveLabel={t("common.save")}
      isSaving={isSaving}
      onTypeChange={(type) => setDraft({ type: "update", update: { type } })}
      onDigitsChange={(digits) => setDraft({ type: "setDigits", digits })}
      onCategoryChange={(categoryId) => setDraft({ type: "update", update: { categoryId } })}
      onAccountChange={(accountId) => setDraft({ type: "update", update: { accountId } })}
      onDescriptionChange={(description) => setDraft({ type: "update", update: { description } })}
      onClose={back}
      onSave={handleSave}
      onDelete={handleDelete}
      extraActionLabel={draft.source === "manual" ? undefined : t("transactions.convertToTransfer")}
      onExtraAction={
        draft.source === "manual" || transactionId == null
          ? undefined
          : () =>
              push({
                pathname: "/reclassify-transaction",
                params: {
                  transactionId,
                },
              })
      }
    />
  );
}
