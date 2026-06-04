import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import { handleNumpadPress } from "@/features/transactions/display.public";
import {
  Button,
  DialogCancelButton,
  DialogFrame,
  DialogPanel,
  DialogTitle,
  PickerOptionRow,
} from "@/shared/components";
import { ArrowLeftRight, Calendar, Pencil, Tag } from "@/shared/components/icons";
import { EntryField, EntryTextInputField } from "@/shared/components/EntryScaffold";
import { Platform, View } from "@/shared/components/rn";
import { useCurrentDate, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay, showSuccessToast } from "@/shared/lib";
import type { TransferSide } from "../lib/build-transfer";
import { TransferSidePicker } from "./transfer-form/TransferSidePicker";
import { TRANSFER_FORM_TEST_IDS } from "./transfer-form/TransferForm.types";
import { useTransferForm } from "./transfer-form/useTransferForm";

function getTransferSideTitle(
  side: TransferSide | null,
  accounts: readonly FinancialAccountRow[],
  t: ReturnType<typeof useTranslation>["t"]
) {
  if (side == null) return undefined;
  if (side.kind === "external") return t("transfers.outsideFidy");
  return accounts.find((account) => account.id === side.accountId)?.name ?? t("common.unknown");
}

export function useTransferEntry(props: { readonly enabled?: boolean } = {}) {
  const { t } = useTranslation();
  const form = useTransferForm({
    enabled: props.enabled ?? true,
    onSuccessfulSave: () => showSuccessToast(t("transfers.saved"), 1.6),
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const maximumDate = useCurrentDate();
  const secondary = useThemeColor("secondary");

  return {
    amount: formatInputDisplay(form.digits),
    fields: (
      <>
        <EntryTextInputField
          icon={Pencil}
          label={t("common.description")}
          value={form.description}
          onChangeText={form.setDescription}
        />
        <View style={{ flexDirection: "row", gap: 12, height: 50 }}>
          <EntryField
            icon={ArrowLeftRight}
            label={`${t("transfers.fromLabel")}:`}
            value={getTransferSideTitle(form.fromSide, form.accounts, t)}
            testID={TRANSFER_FORM_TEST_IDS.fromSide}
            onPress={() => form.setPickerTarget("from")}
          />
          <EntryField
            icon={ArrowLeftRight}
            label={`${t("transfers.toLabel")}:`}
            value={getTransferSideTitle(form.toSide, form.accounts, t)}
            testID={TRANSFER_FORM_TEST_IDS.toSide}
            onPress={() => form.setPickerTarget("to")}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 12, height: 50 }}>
          <EntryField
            icon={Calendar}
            label={form.dateLabel}
            valueTone="primary"
            testID={TRANSFER_FORM_TEST_IDS.date}
            onPress={() => form.setShowDatePicker(true)}
          />
          <EntryField
            icon={Tag}
            label={`${t("common.category")}:`}
            value={t("transfers.activity.generic")}
            valueTone="tertiary"
            onPress={() => setShowCategoryPicker(true)}
          />
        </View>
      </>
    ),
    isConfirmDisabled: !form.canSave || form.isSaving,
    onConfirm: form.handleSave,
    onKeyPress: (key: string) => form.setDigits((digits) => handleNumpadPress(digits, key)),
    overlays: (
      <>
        <TransferSidePicker
          visible={form.pickerTarget != null}
          target={form.pickerTarget}
          currentSide={form.pickerTarget === "from" ? form.fromSide : form.toSide}
          accounts={form.accounts}
          balances={form.balances}
          onClose={form.handlePickerClose}
          onSelect={form.applySelectedSide}
        />
        <DialogFrame
          visible={form.showDatePicker}
          testID="calendar-picker.backdrop"
          onClose={() => form.setShowDatePicker(false)}
        >
          <DialogPanel>
            <DialogTitle>{t("common.date")}</DialogTitle>
            <DateTimePicker
              value={form.date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={maximumDate}
              onChange={form.handleDateChange}
            />
            <Button label={t("common.confirm")} onPress={() => form.setShowDatePicker(false)} />
          </DialogPanel>
        </DialogFrame>
        <DialogFrame
          visible={showCategoryPicker}
          testID="category-picker.backdrop"
          onClose={() => setShowCategoryPicker(false)}
        >
          <DialogPanel maxHeight="72%">
            <DialogTitle>{t("common.category")}</DialogTitle>
            <PickerOptionRow
              selected
              leading={<Tag size={20} color={secondary} />}
              title={t("transfers.activity.generic")}
              onPress={() => setShowCategoryPicker(false)}
            />
            <DialogCancelButton onPress={() => setShowCategoryPicker(false)} />
          </DialogPanel>
        </DialogFrame>
      </>
    ),
  };
}
