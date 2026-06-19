import {
  Button,
  DatePickerControl,
  DialogFrame,
  DialogPanel,
  DialogTitle,
} from "@/shared/components";
import { Platform } from "@/shared/components/rn";
import { useCurrentDate, useTranslation } from "@/shared/hooks";

export function TransactionDatePickerDialog(props: {
  readonly allowFuture?: boolean;
  readonly date: Date;
  readonly maximumDate?: Date;
  readonly minimumDate?: Date;
  readonly onChange: (date: Date) => void;
  readonly onClose: () => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const currentDate = useCurrentDate();
  const maximumDate = props.allowFuture ? undefined : (props.maximumDate ?? currentDate);

  return (
    <DialogFrame visible={props.visible} testID="calendar-picker.backdrop" onClose={props.onClose}>
      <DialogPanel>
        <DialogTitle>{t("common.date")}</DialogTitle>
        <DatePickerControl
          value={props.date}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={maximumDate}
          minimumDate={props.minimumDate}
          onClose={props.onClose}
          onSelect={props.onChange}
        />
        <Button label={t("common.confirm")} onPress={props.onClose} />
      </DialogPanel>
    </DialogFrame>
  );
}
