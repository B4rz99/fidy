import * as Haptics from "expo-haptics";
import { useReducer } from "react";
import { useShallow } from "zustand/react/shallow";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import { useAvailableCategories } from "@/features/categories/hooks.public";
import {
  type FinancialAccountRow,
  getFinancialAccountsForUser,
  tryEnsureDefaultFinancialAccount,
} from "@/features/financial-accounts/public";
import { useTransferEntry } from "@/features/transfers/ui.public";
import { Calendar, Pencil, Wallet } from "@/shared/components/icons";
import {
  EntryField,
  EntryScaffold,
  EntryTextInputField,
  type EntryTab,
} from "@/shared/components/EntryScaffold";
import { View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useSubscription, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import {
  captureError,
  formatInputDisplay,
  showSuccessToast,
  trackTransactionCreated,
} from "@/shared/lib";
import { getDateLabel } from "../lib/format-date";
import { handleNumpadPress } from "../lib/handle-numpad-press";
import { saveCurrentTransaction, useTransactionStore } from "../store";
import {
  TransactionAccountPickerDialog,
  TransactionDatePickerDialog,
} from "./TransactionEntryPickers";
import { CategoryStrip } from "./CategoryStrip";

type TransactionPicker = "account" | "date" | null;
type AddEntryUiState = {
  readonly accounts: readonly FinancialAccountRow[];
  readonly entryMode: EntryTab;
  readonly picker: TransactionPicker;
};

function mergeUiState(state: AddEntryUiState, patch: Partial<AddEntryUiState>): AddEntryUiState {
  return { ...state, ...patch };
}

type TransactionEntryScreenProps = {
  readonly includesNativeHeader?: boolean;
};

export function TransactionEntryScreen({
  includesNativeHeader = true,
}: TransactionEntryScreenProps = {}) {
  const [uiState, setUiState] = useReducer(mergeUiState, {
    accounts: [],
    entryMode: "expense",
    picker: null,
  });
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const categories = useAvailableCategories();
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
  const selectedAccount = uiState.accounts.find((account) => account.id === accountId);
  const isTransfer = uiState.entryMode === "transfer";
  const transferEntry = useTransferEntry({ enabled: isTransfer });
  const dateLabel = getDateLabel({
    date,
    now: new Date(),
    todayLabel: t("dates.today"),
    dateFnsLocale: getDateFnsLocale(locale),
  });
  const activeTab = isTransfer ? "transfer" : type;

  useSubscription(
    () => {
      if (!db || !userId) return;
      try {
        const defaultAccount = tryEnsureDefaultFinancialAccount(db, userId);
        if (defaultAccount) setDefaultAccountId(defaultAccount.id);
        setUiState({ accounts: getFinancialAccountsForUser(db, userId) });
      } catch (error) {
        captureError(error);
      }
    },
    [db, userId],
    db != null && userId != null
  );

  const handleTabPress = (tab: EntryTab) => {
    setUiState({ entryMode: tab });
    if (tab !== "transfer") setType(tab);
  };
  const handleSave = () => {
    void guardedSave(async () => {
      if (!db || !userId) return;
      const result = await saveCurrentTransaction(db, userId);
      if (!result.success) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackTransactionCreated({ type, category: String(categoryId ?? ""), source: "manual" });
      resetForm();
      showSuccessToast(t("transactions.saved"), 1.6);
    });
  };
  const transactionFields = (
    <>
      <EntryTextInputField
        icon={Pencil}
        label={t("transactions.descriptionExample")}
        value={description}
        onChangeText={setDescription}
      />
      <View style={{ flexDirection: "row", gap: 12, height: 50 }}>
        <EntryField
          icon={Wallet}
          label=""
          value={selectedAccount?.name ?? t("common.account")}
          onPress={() => setUiState({ picker: "account" })}
        />
        <EntryField
          icon={Calendar}
          label={dateLabel}
          valueTone="primary"
          onPress={() => setUiState({ picker: "date" })}
        />
      </View>
      <CategoryStrip
        categories={categories}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
      />
    </>
  );

  return (
    <>
      <EntryScaffold
        activeTab={activeTab}
        amount={isTransfer ? transferEntry.amount : formatInputDisplay(digits)}
        isConfirmDisabled={
          isTransfer
            ? transferEntry.isConfirmDisabled
            : isSaving || !accountId || !categoryId || digits.length === 0
        }
        onConfirm={isTransfer ? transferEntry.onConfirm : handleSave}
        onKeyPress={
          isTransfer
            ? transferEntry.onKeyPress
            : (key) => setDigits((currentDigits) => handleNumpadPress(currentDigits, key))
        }
        onTabPress={handleTabPress}
        tabs={[
          { key: "expense", label: t("transactions.expense") },
          { key: "income", label: t("transactions.income") },
          { key: "transfer", label: t("transfers.activity.generic") },
        ]}
        fields={isTransfer ? transferEntry.fields : transactionFields}
        includesNativeHeader={includesNativeHeader}
      />
      {transferEntry.overlays}
      <TransactionAccountPickerDialog
        accountId={accountId}
        accounts={uiState.accounts}
        visible={uiState.picker === "account"}
        onClose={() => setUiState({ picker: null })}
        onSelect={(nextAccountId) => {
          setAccountId(nextAccountId);
          setUiState({ picker: null });
        }}
      />
      <TransactionDatePickerDialog
        date={date}
        visible={uiState.picker === "date"}
        onClose={() => setUiState({ picker: null })}
        onChange={setDate}
      />
    </>
  );
}
