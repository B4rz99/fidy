import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import { getNeedsReviewEmailByTransactionId } from "@/features/email-capture";
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
import type { CategoryId, FinancialAccountId, ProcessedEmailId } from "@/shared/types/branded";

export default function EditTransactionScreen() {
  const { transactionId: routeTransactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const navigation = useNavigation();
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
  const [source, setSource] = useState("manual");
  const [loaded, setLoaded] = useState(false);
  const [accounts, setAccounts] = useState<readonly FinancialAccountRow[]>([]);
  const [reclassificationProcessedEmailId, setReclassificationProcessedEmailId] =
    useState<ProcessedEmailId | null>(null);
  const transactionId =
    typeof routeTransactionId === "string" && routeTransactionId.trim().length > 0
      ? requireTransactionId(routeTransactionId.trim())
      : null;

  useMountEffect(() => {
    if (transactionId == null || !db || !userId) {
      router.back();
      return;
    }

    void (async () => {
      tryEnsureDefaultFinancialAccount(db, userId);
      setAccounts(getFinancialAccountsForUser(db, userId));
      const tx = getStoredTransactionById(db, userId, transactionId);
      if (!tx) {
        router.back();
        return;
      }

      const reviewEmail = await getNeedsReviewEmailByTransactionId(db, transactionId).catch(
        () => null
      );

      setType(tx.type);
      setDigits(String(tx.amount));
      setCategoryId(tx.categoryId);
      setAccountId(tx.accountId);
      setDescription(tx.description);
      setDate(tx.date);
      setSource(tx.source ?? "manual");
      setReclassificationProcessedEmailId(reviewEmail?.id ?? null);
      setLoaded(true);
    })();
  });

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const dismissAndWait = () => {
    const pendingTransition = waitForNavigationTransition(navigation, { closing: true, fallbackMs: 2000 });
    router.back();
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
            type,
            digits,
            categoryId,
            accountId,
            description,
            date: clampDateToToday(date),
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
      extraActionLabel={source === "manual" ? undefined : t("transactions.convertToTransfer")}
      onExtraAction={
        source === "manual" || transactionId == null
          ? undefined
          : () =>
              router.push({
                pathname: "/reclassify-transaction",
                params: {
                  transactionId,
                  processedEmailId: reclassificationProcessedEmailId ?? undefined,
                },
              } as never)
      }
    />
  );
}
