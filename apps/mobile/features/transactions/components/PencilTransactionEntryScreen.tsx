import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import {
  type FinancialAccountRow,
  getFinancialAccountsForUser,
  tryEnsureDefaultFinancialAccount,
} from "@/features/financial-accounts/public";
import { PencilTransferEntryScreen } from "@/features/transfers/routes.public";
import { Calendar, Pencil, Tag, Wallet } from "@/shared/components/icons";
import {
  PencilEntryField,
  PencilEntryScaffold,
  PencilEntryTextInputField,
  type PencilEntryTab,
} from "@/shared/components/PencilEntryScaffold";
import { View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useSubscription, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { captureError, formatInputDisplay, trackTransactionCreated } from "@/shared/lib";
import { CATEGORIES } from "../lib/categories";
import { getDateLabel } from "../lib/format-date";
import { handleNumpadPress } from "../lib/handle-numpad-press";
import { saveCurrentTransaction, useTransactionStore } from "../store";
import {
  TransactionAccountPickerSheet,
  TransactionCategoryPickerSheet,
  TransactionDatePickerSheet,
} from "./PencilTransactionEntrySheets";

export function PencilTransactionEntryScreen() {
  const [entryMode, setEntryMode] = useState<PencilEntryTab>("expense");

  if (entryMode === "transfer") {
    return <PencilTransferEntryScreen onTransactionTabSelect={setEntryMode} />;
  }

  return <PencilTransactionEntryContent onTransferTabSelect={() => setEntryMode("transfer")} />;
}

function PencilTransactionEntryContent(props: { readonly onTransferTabSelect: () => void }) {
  const { navigate } = useRouter();
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const [accounts, setAccounts] = useState<readonly FinancialAccountRow[]>([]);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const {
    accountId,
    categoryId,
    date,
    description,
    digits,
    resetForm,
    setAccountId,
    setCategoryId,
    setDate,
    setDefaultAccountId,
    setDescription,
    setDigits,
    setType,
    type,
  } = useTransactionStore(
    useShallow((state) => ({
      accountId: state.accountId,
      categoryId: state.categoryId,
      date: state.date,
      description: state.description,
      digits: state.digits,
      resetForm: state.resetForm,
      setAccountId: state.setAccountId,
      setCategoryId: state.setCategoryId,
      setDate: state.setDate,
      setDefaultAccountId: state.setDefaultAccountId,
      setDescription: state.setDescription,
      setDigits: state.setDigits,
      setType: state.setType,
      type: state.type,
    }))
  );
  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const selectedCategory = CATEGORIES.find((category) => category.id === categoryId);
  const dateLabel = getDateLabel({
    date,
    now: new Date(),
    todayLabel: t("dates.today"),
  });

  useSubscription(
    () => {
      if (!db || !userId) return;
      try {
        const defaultAccount = tryEnsureDefaultFinancialAccount(db, userId);
        if (defaultAccount) setDefaultAccountId(defaultAccount.id);
        setAccounts(getFinancialAccountsForUser(db, userId));
      } catch (error) {
        captureError(error);
      }
    },
    [db, userId],
    db != null && userId != null
  );

  const handleTabPress = (tab: PencilEntryTab) => {
    if (tab === "transfer") {
      props.onTransferTabSelect();
      return;
    }
    setType(tab);
  };

  const handleSave = () => {
    void guardedSave(async () => {
      if (!db || !userId) return;
      const result = await saveCurrentTransaction(db, userId);
      if (result.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        trackTransactionCreated({
          type,
          category: String(categoryId ?? ""),
          source: "manual",
        });
        resetForm();
        navigate("/(tabs)" as never);
      }
    });
  };

  return (
    <>
      <PencilEntryScaffold
        activeTab={type}
        amount={formatInputDisplay(digits)}
        isConfirmDisabled={isSaving || !accountId || !categoryId || digits.length === 0}
        onConfirm={handleSave}
        onKeyPress={(key) => setDigits((currentDigits) => handleNumpadPress(currentDigits, key))}
        onTabPress={handleTabPress}
        tabs={[
          { key: "expense", label: t("transactions.expense") },
          { key: "income", label: t("transactions.income") },
          { key: "transfer", label: t("transfers.activity.generic") },
        ]}
        fields={
          <>
            <PencilEntryTextInputField
              icon={Pencil}
              label={t("common.description")}
              value={description}
              onChangeText={setDescription}
            />
            <PencilEntryField
              icon={Wallet}
              label={`${t("common.account")}:`}
              value={selectedAccount?.name}
              onPress={() => setShowAccountPicker(true)}
            />
            <View style={{ flexDirection: "row", gap: 12, height: 50 }}>
              <PencilEntryField
                icon={Calendar}
                label={dateLabel}
                valueTone="primary"
                onPress={() => setShowDatePicker(true)}
              />
              <PencilEntryField
                icon={Tag}
                label={`${t("common.category")}:`}
                value={selectedCategory ? getCategoryLabel(selectedCategory, locale) : undefined}
                valueTone={selectedCategory ? "primary" : "tertiary"}
                onPress={() => setShowCategoryPicker(true)}
              />
            </View>
          </>
        }
      />

      <TransactionAccountPickerSheet
        accountId={accountId}
        accounts={accounts}
        visible={showAccountPicker}
        onClose={() => setShowAccountPicker(false)}
        onSelect={(nextAccountId) => {
          setAccountId(nextAccountId);
          setShowAccountPicker(false);
        }}
      />
      <TransactionDatePickerSheet
        date={date}
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onChange={setDate}
      />
      <TransactionCategoryPickerSheet
        categoryId={categoryId}
        locale={locale}
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(nextCategoryId) => {
          setCategoryId(nextCategoryId);
          setShowCategoryPicker(false);
        }}
      />
    </>
  );
}
