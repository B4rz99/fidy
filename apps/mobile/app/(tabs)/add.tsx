import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { TransactionForm, useTransactionStore } from "@/features/transactions";
import { useAsyncGuard, useTranslation } from "@/shared/hooks";
import { trackTransactionCreated } from "@/shared/lib";

export default function AddTransactionScreen() {
  const { navigate } = useRouter();
  const { t } = useTranslation();
  const {
    type,
    digits,
    categoryId,
    description,
    date,
    setType,
    setDigits,
    setCategoryId,
    setDescription,
    saveTransaction,
    resetForm,
  } = useTransactionStore(
    useShallow((s) => ({
      type: s.type,
      digits: s.digits,
      categoryId: s.categoryId,
      description: s.description,
      date: s.date,
      setType: s.setType,
      setDigits: s.setDigits,
      setCategoryId: s.setCategoryId,
      setDescription: s.setDescription,
      saveTransaction: s.saveTransaction,
      resetForm: s.resetForm,
    }))
  );

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = useCallback(
    () =>
      guardedSave(async () => {
        const result = await saveTransaction();
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          trackTransactionCreated({
            type,
            category: String(categoryId ?? ""),
            source: "manual",
          });
          resetForm();
          navigate("/(tabs)" as never);
        }
      }),
    [guardedSave, saveTransaction, type, categoryId, resetForm, navigate]
  );

  return (
    <TransactionForm
      type={type}
      digits={digits}
      categoryId={categoryId}
      description={description}
      date={date}
      saveLabel={t("transactions.saveTransaction")}
      isSaving={isSaving}
      onTypeChange={setType}
      onDigitsChange={setDigits}
      onCategoryChange={setCategoryId}
      onDescriptionChange={setDescription}
      onSave={handleSave}
    />
  );
}
