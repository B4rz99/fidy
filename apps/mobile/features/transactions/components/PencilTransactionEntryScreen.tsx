import * as Haptics from "expo-haptics";
import { useReducer } from "react";
import { useShallow } from "zustand/react/shallow";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import {
  type FinancialAccountRow,
  getFinancialAccountsForUser,
  tryEnsureDefaultFinancialAccount,
} from "@/features/financial-accounts/public";
import { usePencilTransferEntry } from "@/features/transfers/ui.public";
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
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import {
  captureError,
  formatInputDisplay,
  showSuccessToast,
  trackTransactionCreated,
} from "@/shared/lib";
import { CATEGORIES } from "../lib/categories";
import { getDateLabel } from "../lib/format-date";
import { handleNumpadPress } from "../lib/handle-numpad-press";
import { saveCurrentTransaction, useTransactionStore } from "../store";
import {
  TransactionAccountPickerDialog,
  TransactionCategoryPickerDialog,
  TransactionDatePickerDialog,
} from "./PencilTransactionEntryPickers";

type TransactionPicker = "account" | "category" | "date" | null;
type AddEntryUiState = {
  readonly accounts: readonly FinancialAccountRow[];
  readonly entryMode: PencilEntryTab;
  readonly picker: TransactionPicker;
};

function mergeUiState(state: AddEntryUiState, patch: Partial<AddEntryUiState>): AddEntryUiState {
  return { ...state, ...patch };
}

type PencilTransactionEntryScreenProps = {
  readonly includesNativeHeader?: boolean;
};

export function PencilTransactionEntryScreen({
  includesNativeHeader = true,
}: PencilTransactionEntryScreenProps = {}) {
  const [uiState, setUiState] = useReducer(mergeUiState, {
    accounts: [],
    entryMode: "expense",
    picker: null,
  });
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
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
  const selectedCategory = CATEGORIES.find((category) => category.id === categoryId);
  const isTransfer = uiState.entryMode === "transfer";
  const transferEntry = usePencilTransferEntry({ enabled: isTransfer });
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

  const handleTabPress = (tab: PencilEntryTab) => {
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
      <PencilEntryTextInputField
        icon={Pencil}
        label={t("common.description")}
        value={description}
        onChangeText={setDescription}
      />
      <PencilEntryField
        icon={Wallet}
        label=""
        value={selectedAccount?.name ?? t("common.account")}
        onPress={() => setUiState({ picker: "account" })}
      />
      <View style={{ flexDirection: "row", gap: 12, height: 50 }}>
        <PencilEntryField
          icon={Calendar}
          label={dateLabel}
          valueTone="primary"
          onPress={() => setUiState({ picker: "date" })}
        />
        <PencilEntryField
          icon={Tag}
          label={`${t("common.category")}:`}
          value={selectedCategory ? getCategoryLabel(selectedCategory, locale) : undefined}
          valueTone={selectedCategory ? "primary" : "tertiary"}
          onPress={() => setUiState({ picker: "category" })}
        />
      </View>
    </>
  );

  return (
    <>
      <PencilEntryScaffold
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
      <TransactionCategoryPickerDialog
        categoryId={categoryId}
        locale={locale}
        visible={uiState.picker === "category"}
        onClose={() => setUiState({ picker: null })}
        onSelect={(nextCategoryId) => {
          setCategoryId(nextCategoryId);
          setUiState({ picker: null });
        }}
      />
    </>
  );
}
