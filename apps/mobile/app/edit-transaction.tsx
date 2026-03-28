import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import type { TransactionType } from "@/features/transactions";
import { TransactionForm, useTransactionStore } from "@/features/transactions";
import { useAsyncGuard, useMountEffect, useTranslation } from "@/shared/hooks";
import type { CategoryId, TransactionId } from "@/shared/types/branded";

export default function EditTransactionScreen() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const getTransactionById = useTransactionStore((s) => s.getTransactionById);
  const updateTransactionDirect = useTransactionStore((s) => s.updateTransactionDirect);
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction);

  const [type, setType] = useState<TransactionType>("expense");
  const [digits, setDigits] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [loaded, setLoaded] = useState(false);

  useMountEffect(() => {
    const tx = getTransactionById(transactionId as TransactionId);
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

  const handleSave = () =>
    guardedSave(async () => {
      const result = await updateTransactionDirect(transactionId as TransactionId, {
        type,
        digits,
        categoryId,
        description,
        date,
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    });

  const handleDelete = () =>
    guardedSave(async () => {
      await deleteTransaction(transactionId as TransactionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    });

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
    />
  );
}
