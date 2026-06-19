import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform } from "@/shared/components/rn";

type DatePickerDisplay = "default" | "compact" | "spinner";

type DatePickerControlProps = {
  readonly value: Date;
  readonly display?: DatePickerDisplay;
  readonly maximumDate?: Date;
  readonly minimumDate?: Date;
  readonly onClose?: () => void;
  readonly onSelect: (date: Date) => void;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID?: string;
};

function isDatePickerDismissed(event: unknown) {
  return (
    typeof event === "object" && event !== null && "type" in event && event.type === "dismissed"
  );
}

export function DatePickerControl({
  display = "default",
  maximumDate,
  minimumDate,
  onClose,
  onSelect,
  testID,
  value,
}: DatePickerControlProps) {
  return (
    <DateTimePicker
      testID={testID}
      value={value}
      mode="date"
      display={display}
      maximumDate={maximumDate}
      minimumDate={minimumDate}
      onChange={(event, nextDate) => {
        if (Platform.OS !== "ios") onClose?.();
        if (!isDatePickerDismissed(event) && nextDate) {
          onSelect(nextDate);
        }
      }}
    />
  );
}

export type { DatePickerControlProps, DatePickerDisplay };
