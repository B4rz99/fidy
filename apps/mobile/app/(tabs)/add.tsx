import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useOptionalUserId } from "@/features/auth";
import {
  type FinancialAccountRow,
  getFinancialAccountsForUser,
  tryEnsureDefaultFinancialAccount,
} from "@/features/financial-accounts";
import {
  saveCurrentTransaction,
  TransactionForm,
  updateCurrentTransaction,
  useTransactionStore,
} from "@/features/transactions";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useSubscription, useTranslation } from "@/shared/hooks";
import { captureError, trackTransactionCreated } from "@/shared/lib";

export default function AddTransactionScreen() {
  const { navigate } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const [accounts, setAccounts] = useState<readonly FinancialAccountRow[]>([]);
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
  } = useTransactionStore(
    useShallow((state) => ({
      type: state.type,
      digits: state.digits,
      categoryId: state.categoryId,
      accountId: state.accountId,
      description: state.description,
      date: state.date,
      editingId: state.editingId,
      setType: state.setType,
      setDigits: state.setDigits,
      setCategoryId: state.setCategoryId,
      setDefaultAccountId: state.setDefaultAccountId,
      setAccountId: state.setAccountId,
      setDescription: state.setDescription,
      resetForm: state.resetForm,
    }))
  );

  const isEditing = editingId != null;

  useSubscription(
    () => {
      if (!db || !userId) return;
      try {
        const defaultAccount = tryEnsureDefaultFinancialAccount(db, userId);
        if (defaultAccount) {
          setDefaultAccountId(defaultAccount.id);
        }
        setAccounts(getFinancialAccountsForUser(db, userId));
      } catch (error) {
        captureError(error);
      }
    },
    [db, userId],
    db != null && userId != null
  );

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
