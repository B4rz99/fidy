import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useOptionalUserId } from "@/features/auth";
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
import type { CategoryId } from "@/shared/types/branded";

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
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [loaded, setLoaded] = useState(false);
  const transactionId =
    typeof routeTransactionId === "string" && routeTransactionId.trim().length > 0
      ? requireTransactionId(routeTransactionId.trim())
      : null;

  useMountEffect(() => {
    if (transactionId == null || !db || !userId) {
      router.back();
      return;
    }

    const tx = getStoredTransactionById(db, userId, transactionId);
    if (tx) {
      setType(tx.type);
      setDigits(String(tx.amount));
      setCategoryId(tx.categoryId);
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
      if (transactionId == null) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      await afterDismiss();
      try {
        if (!db || !userId) return;
        const result = await updateTransactionDirect(db, userId, transactionId, {
          type,
          digits,
          categoryId,
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
      if (transactionId == null) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      await afterDismiss();
      try {
        if (!db || !userId) return;
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
      description={description}
      date={date}
      saveLabel={t("common.save")}
      isSaving={isSaving}
      onTypeChange={setType}
      onDigitsChange={setDigits}
      onCategoryChange={setCategoryId}
      onDescriptionChange={setDescription}
      onSave={handleSave}
      onDelete={handleDelete}
      onClose={() => router.back()}
    />
  );
}
