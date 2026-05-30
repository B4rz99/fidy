import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, Pressable, Text, View } from "@/shared/components/rn";
import { useCurrentDate, useThemeColor, useTranslation } from "@/shared/hooks";
import { PickerSheetFrame } from "./PickerSheetFrame";
import { SheetTitle } from "./SheetTitle";

export function TransactionDatePickerSheet(props: {
  readonly allowFuture?: boolean;
  readonly date: Date;
  readonly maximumDate?: Date;
  readonly minimumDate?: Date;
  readonly onChange: (date: Date) => void;
  readonly onClose: () => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const card = useThemeColor("card");
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
  const currentDate = useCurrentDate();
  const maximumDate = props.allowFuture ? undefined : (props.maximumDate ?? currentDate);

  return (
    <PickerSheetFrame
      visible={props.visible}
      testID="calendar-picker.backdrop"
      onClose={props.onClose}
    >
      <View
        style={{
          gap: 12,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          borderRadius: 24,
          backgroundColor: card,
          padding: 16,
        }}
        onStartShouldSetResponder={() => true}
      >
        <SheetTitle>{t("common.date")}</SheetTitle>
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
      </View>
    </PickerSheetFrame>
  );
}
