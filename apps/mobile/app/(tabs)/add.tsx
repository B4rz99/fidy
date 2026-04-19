import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useOptionalUserId } from "@/features/auth";
import {
  ensureDefaultFinancialAccount,
  getFinancialAccountsForUser,
} from "@/features/financial-accounts";
import {
  saveCurrentTransaction,
  TransactionForm,
  updateCurrentTransaction,
  useTransactionStore,
} from "@/features/transactions";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useMountEffect, useTranslation } from "@/shared/hooks";
import { trackTransactionCreated } from "@/shared/lib";

export default function AddTransactionScreen() {
  const { navigate } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const {
    type,
    digits,
    categoryId,
    accountId,
    description,
    date,
    editingId,
    setType,
    setDigits,
    setCategoryId,
    setDefaultAccountId,
    setAccountId,
    setDescription,
    resetForm,
  } = useTransactionStore();

  const isEditing = editingId != null;

  useMountEffect(() => {
    if (!db || !userId) return;
    const defaultAccount = ensureDefaultFinancialAccount(db, userId);
    setDefaultAccountId(defaultAccount.id);
  });

  const accounts = db && userId ? getFinancialAccountsForUser(db, userId) : [];

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = () => {
    void guardedSave(async () => {
      if (!db || !userId) return;
      const result = isEditing
        ? await updateCurrentTransaction(db, userId, editingId)
        : await saveCurrentTransaction(db, userId);
      if (result.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    });
  };

  return (
    <TransactionForm
      type={type}
      digits={digits}
      categoryId={categoryId}
      accounts={accounts}
      accountId={accountId}
      description={description}
      date={date}
      saveLabel={isEditing ? t("common.save") : t("transactions.saveTransaction")}
      isSaving={isSaving}
      onTypeChange={setType}
      onDigitsChange={setDigits}
      onCategoryChange={setCategoryId}
      onAccountChange={setAccountId}
      onDescriptionChange={setDescription}
      onSave={handleSave}
    />
  );
}
