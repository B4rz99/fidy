import { FormTextField, Surface } from "@/shared/components";
import { Calendar, Pencil } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { styles } from "./TransactionForm.styles";

type TransactionMetadataRowProps = {
  readonly dateLabel: string;
  readonly description: string;
  readonly descriptionPlaceholder: string;
  readonly onDescriptionBlur: () => void;
  readonly onDescriptionChange: (text: string) => void;
  readonly onDescriptionFocus: () => void;
  readonly onDatePress?: () => void;
  readonly primaryColor: string;
  readonly secondaryColor: string;
};

export function TransactionMetadataRow({
  dateLabel,
  description,
  descriptionPlaceholder,
  onDescriptionBlur,
  onDescriptionChange,
  onDescriptionFocus,
  onDatePress,
  primaryColor,
  secondaryColor,
}: TransactionMetadataRowProps) {
  return (
    <View style={styles.metadataRow}>
      <FormTextField
        icon={Pencil}
        testID="transaction-form.description"
        label={descriptionPlaceholder}
        labelStyle={{ display: "none" }}
        style={{ flex: 1, gap: 0 }}
        inputStyle={[styles.descriptionInput, { color: primaryColor }]}
        placeholder={descriptionPlaceholder}
        value={description}
        onChangeText={onDescriptionChange}
        onFocus={onDescriptionFocus}
        onBlur={onDescriptionBlur}
        maxLength={200}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!onDatePress}
        onPress={onDatePress}
        style={styles.datePressable}
        testID="transaction-form.date"
      >
        <Surface padded={false} radius={10} style={styles.dateChip}>
          <Calendar size={14} color={secondaryColor} />
          <Text
            style={{
              color: primaryColor,
              fontFamily: "Poppins_500Medium",
              fontSize: 12,
            }}
          >
            {dateLabel}
          </Text>
        </Surface>
      </Pressable>
    </View>
  );
}
