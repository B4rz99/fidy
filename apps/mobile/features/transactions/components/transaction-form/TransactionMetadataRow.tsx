import { Calendar } from "@/shared/components/icons";
import { FormTextField } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { styles } from "./TransactionForm.styles";

type TransactionMetadataRowProps = {
  readonly borderSubtle: string;
  readonly dateLabel: string;
  readonly description: string;
  readonly descriptionPlaceholder: string;
  readonly onDescriptionBlur: () => void;
  readonly onDescriptionChange: (text: string) => void;
  readonly onDescriptionFocus: () => void;
  readonly primaryColor: string;
  readonly secondaryColor: string;
};

export function TransactionMetadataRow({
  borderSubtle,
  dateLabel,
  description,
  descriptionPlaceholder,
  onDescriptionBlur,
  onDescriptionChange,
  onDescriptionFocus,
  primaryColor,
  secondaryColor,
}: TransactionMetadataRowProps) {
  return (
    <View style={styles.metadataRow}>
      <FormTextField
        testID="transaction-form.description"
        label={descriptionPlaceholder}
        labelStyle={{ display: "none" }}
        style={{ flex: 1, gap: 0 }}
        inputStyle={[styles.descriptionInput, { borderColor: borderSubtle, color: primaryColor }]}
        placeholder={descriptionPlaceholder}
        value={description}
        onChangeText={onDescriptionChange}
        onFocus={onDescriptionFocus}
        onBlur={onDescriptionBlur}
        maxLength={200}
      />
      <View testID="transaction-form.date" style={[styles.dateChip, { borderColor: borderSubtle }]}>
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
      </View>
    </View>
  );
}
