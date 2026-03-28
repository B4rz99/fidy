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
    editingId,
    setType,
    setDigits,
    setCategoryId,
    setDescription,
    saveTransaction,
    updateTransaction,
    resetForm,
  } = useTransactionStore(
    useShallow((s) => ({
      type: s.type,
      digits: s.digits,
      categoryId: s.categoryId,
      description: s.description,
      date: s.date,
      editingId: s.editingId,
      setType: s.setType,
      setDigits: s.setDigits,
      setCategoryId: s.setCategoryId,
      setDescription: s.setDescription,
      saveTransaction: s.saveTransaction,
      updateTransaction: s.updateTransaction,
      resetForm: s.resetForm,
    }))
  );

  const isEditing = editingId != null;
  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = useCallback(
    () =>
      guardedSave(async () => {
        const result = isEditing ? await updateTransaction(editingId) : await saveTransaction();
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (!isEditing) {
            trackTransactionCreated({
              type,
              category: String(categoryId ?? ""),
              source: "manual",
            });
            resetForm();
          }
          navigate("/(tabs)" as never);
        }
      }),
    [
      guardedSave,
      isEditing,
      editingId,
      updateTransaction,
      saveTransaction,
      type,
      categoryId,
      resetForm,
      navigate,
    ]
  );

  const saveLabel = isEditing ? t("common.save") : t("transactions.saveTransaction");

  return (
    <TransactionForm
      type={type}
      digits={digits}
      categoryId={categoryId}
      description={description}
      date={date}
      saveLabel={saveLabel}
      isSaving={isSaving}
      onTypeChange={setType}
      onDigitsChange={setDigits}
      onCategoryChange={setCategoryId}
      onDescriptionChange={setDescription}
      onSave={handleSave}
    />
  );
}
