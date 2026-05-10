import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScreenLayout } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";
import type { TransferFormScreenProps } from "./transfer-form/TransferForm.types";
import { TransferFormContent } from "./transfer-form/TransferFormContent";
import { TransferSidePicker } from "./transfer-form/TransferSidePicker";
import { useTransferForm } from "./transfer-form/useTransferForm";

export function TransferFormScreen(props: TransferFormScreenProps = {}) {
  const { back } = useRouter();
  const { t } = useTranslation();
  const form = useTransferForm(props);
  const [maximumDate] = useState(() => new Date());

  return (
    <>
      <ScreenLayout
        title={form.isReclassification ? t("transfers.reclassifyTitle") : t("transfers.title")}
        variant="sub"
        onBack={back}
      >
        <TransferFormContent form={form} />
      </ScreenLayout>

      <TransferSidePicker
        visible={form.pickerTarget != null}
        target={form.pickerTarget}
        currentSide={form.pickerTarget === "from" ? form.fromSide : form.toSide}
        accounts={form.accounts}
        balances={form.balances}
        onClose={form.handlePickerClose}
        onSelect={form.applySelectedSide}
      />

      {!form.isIos && form.showDatePicker ? (
        <DateTimePicker
          value={form.date}
          mode="date"
          display="default"
          maximumDate={maximumDate}
          onChange={form.handleDateChange}
        />
      ) : null}
    </>
  );
}
