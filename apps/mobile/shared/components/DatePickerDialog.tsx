import { Button } from "./Button";
import { DatePickerControl } from "./DatePickerControl";
import { DialogFrame, DialogPanel, DialogTitle } from "./DialogFrame";
import { Platform } from "./rn";
import { useCurrentDate } from "../hooks/use-current-date";
import { useTranslation } from "../hooks/use-translation";

type DatePickerDialogProps = {
  readonly allowFuture?: boolean;
  readonly date: Date;
  readonly maximumDate?: Date;
  readonly minimumDate?: Date;
  readonly onChange: (date: Date) => void;
  readonly onClose: () => void;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID?: string;
  readonly visible: boolean;
};

export function DatePickerDialog({
  allowFuture = false,
  date,
  maximumDate,
  minimumDate,
  onChange,
  onClose,
  testID = "calendar-picker.backdrop",
  visible,
}: DatePickerDialogProps) {
  const { t } = useTranslation();
  const currentDate = useCurrentDate();
  const resolvedMaximumDate = maximumDate ?? (allowFuture ? undefined : currentDate);

  return (
    <DialogFrame visible={visible} testID={testID} onClose={onClose}>
      <DialogPanel>
        <DialogTitle>{t("common.date")}</DialogTitle>
        <DatePickerControl
          value={date}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={resolvedMaximumDate}
          minimumDate={minimumDate}
          onSelect={onChange}
          onClose={onClose}
        />
        <Button label={t("common.confirm")} onPress={onClose} />
      </DialogPanel>
    </DialogFrame>
  );
}

export type { DatePickerDialogProps };
