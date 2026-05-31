import DateTimePicker from "@react-native-community/datetimepicker";
import { DialogFrame, DialogPanel, DialogTitle } from "@/shared/components";
import { Platform, Pressable, Text } from "@/shared/components/rn";
import { useCurrentDate, useThemeColor, useTranslation } from "@/shared/hooks";

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
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
  const currentDate = useCurrentDate();
  const maximumDate = props.allowFuture ? undefined : (props.maximumDate ?? currentDate);

  return (
    <DialogFrame visible={props.visible} testID="calendar-picker.backdrop" onClose={props.onClose}>
      <DialogPanel backgroundRole="card">
        <DialogTitle>{t("common.date")}</DialogTitle>
        <DateTimePicker
          value={props.date}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={maximumDate}
          minimumDate={props.minimumDate}
          onChange={(_event, nextDate) => {
            if (Platform.OS !== "ios") props.onClose();
            if (nextDate) {
              props.onChange(nextDate);
            }
          }}
        />
        <Pressable
          style={{
            alignItems: "center",
            borderRadius: 16,
            backgroundColor: accentGreen,
            paddingVertical: 14,
          }}
          onPress={props.onClose}
          accessibilityRole="button"
        >
          <Text style={{ color: onAccent, fontFamily: "Poppins_600SemiBold", fontSize: 15 }}>
            {t("common.confirm")}
          </Text>
        </Pressable>
      </DialogPanel>
    </DialogFrame>
  );
}
