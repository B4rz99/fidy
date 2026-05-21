import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { ScreenLayout } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useCurrentDate, useTranslation } from "@/shared/hooks";
import type { TransferFormScreenProps } from "./transfer-form/TransferForm.types";
import { TransferFormContent } from "./transfer-form/TransferFormContent";
import { TransferSidePicker } from "./transfer-form/TransferSidePicker";
import { useTransferForm } from "./transfer-form/useTransferForm";

export function TransferFormScreen(props: TransferFormScreenProps = {}) {
  const { back } = useRouter();
  const { t } = useTranslation();
  const form = useTransferForm(props);
  const maximumDate = useCurrentDate();
  const title = form.isReclassification ? t("transfers.reclassifyTitle") : t("transfers.title");
  const content = (
    <>
      {props.presentation === "dialog" ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text className="font-poppins-bold text-title text-primary dark:text-primary-dark">
            {title}
          </Text>
        </View>
      ) : null}
      <TransferFormContent form={form} />
    </>
  );

  return (
    <>
      {props.presentation === "dialog" ? (
        content
      ) : (
        <ScreenLayout title={title} variant="sub" onBack={back}>
          {content}
        </ScreenLayout>
      )}

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
