import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import {
  ensureDefaultFinancialAccount,
  getFinancialAccountsForUser,
} from "@/features/financial-accounts";
import type { TransactionType } from "@/features/transactions";
import {
  deleteTransaction,
  getStoredTransactionById,
  TransactionForm,
  updateTransactionDirect,
} from "@/features/transactions";
import { InteractionManager } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useMountEffect, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import { requireTransactionId } from "@/shared/types/assertions";
import type { CategoryId, FinancialAccountId } from "@/shared/types/branded";

const afterDismiss = () =>
  new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });

export default function EditTransactionScreen() {
  const { transactionId: routeTransactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  const [type, setType] = useState<TransactionType>("expense");
  const [digits, setDigits] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [accountId, setAccountId] = useState<FinancialAccountId | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [loaded, setLoaded] = useState(false);
  const transactionId =
    typeof routeTransactionId === "string" && routeTransactionId.trim().length > 0
      ? requireTransactionId(routeTransactionId.trim())
      : null;

  const accounts = db && userId ? getFinancialAccountsForUser(db, userId) : [];

  useMountEffect(() => {
    if (transactionId == null || !db || !userId) {
      router.back();
      return;
    }

    ensureDefaultFinancialAccount(db, userId);
    const tx = getStoredTransactionById(db, userId, transactionId);
    if (tx) {
      setType(tx.type);
      setDigits(String(tx.amount));
      setCategoryId(tx.categoryId);
      setAccountId(tx.accountId);
      setDescription(tx.description);
      setDate(tx.date);
      setLoaded(true);
    } else {
      router.back();
    }
  });

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = () => {
    void guardedSave(async () => {
      if (transactionId == null || !db || !userId) {
        showErrorToast(t("transactions.updateFailed"));
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      await afterDismiss();
      try {
        const result = await updateTransactionDirect(db, userId, transactionId, {
          type,
          digits,
          categoryId,
          accountId,
          description,
          date,
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
      router.back();
      await afterDismiss();
      try {
        await deleteTransaction(db, userId, transactionId);
      } catch {
        showErrorToast(t("transactions.deleteFailed"));
      }
    });
  };

  if (!loaded) return null;

  return (
    <TransactionForm
      type={type}
      digits={digits}
      categoryId={categoryId}
      accounts={accounts}
      accountId={accountId}
      description={description}
      date={date}
      saveLabel={t("common.save")}
      isSaving={isSaving}
      onTypeChange={setType}
      onDigitsChange={setDigits}
      onCategoryChange={setCategoryId}
      onAccountChange={setAccountId}
      onDescriptionChange={setDescription}
      onSave={handleSave}
      onDelete={handleDelete}
      onClose={() => router.back()}
    />
  );
}
