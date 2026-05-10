import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORIES, type CategoryId } from "@/shared/categories";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { type BillFrequency, FREQUENCIES } from "../../schema";
import { styles } from "./AddBillForm.styles";

type AddBillFormContentProps = {
  readonly amount: string;
  readonly amountRef: React.RefObject<TextInput | null>;
  readonly canSubmit: boolean;
  readonly category: CategoryId;
  readonly frequency: BillFrequency;
  readonly handleCategoryPress: (id: CategoryId) => void;
  readonly handleFrequencyPress: (value: BillFrequency) => void;
  readonly handleSave: () => void;
  readonly isEdit: boolean;
  readonly isSaving: boolean;
  readonly name: string;
  readonly onAmountChange: (value: string) => void;
  readonly onNameChange: (value: string) => void;
  readonly onStartDateChange: (date: Date) => void;
  readonly startDate: Date;
};

export function AddBillFormContent({
  amount,
  amountRef,
  canSubmit,
  category,
  frequency,
  handleCategoryPress,
  handleFrequencyPress,
  handleSave,
  isEdit,
  isSaving,
  name,
  onAmountChange,
  onNameChange,
  onStartDateChange,
  startDate,
}: AddBillFormContentProps) {
  const { t, locale } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const cardBg = useThemeColor("card");
  const pageBg = useThemeColor("page");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: cardBg }]}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: primaryColor }]}>
          {isEdit ? t("bills.editBill") : t("bills.addBill")}
        </Text>

        <View style={styles.formGrid}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>{t("common.name")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: pageBg, borderColor, color: primaryColor }]}
              value={name}
              onChangeText={onNameChange}
              placeholder="Netflix"
              placeholderTextColor={secondaryColor}
              returnKeyType="next"
              onSubmitEditing={() => amountRef.current?.focus()}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>{t("common.amount")}</Text>
            <TextInput
              ref={amountRef}
              style={[styles.input, { backgroundColor: pageBg, borderColor, color: primaryColor }]}
              value={amount}
              onChangeText={onAmountChange}
              placeholder="50000"
              placeholderTextColor={secondaryColor}
              keyboardType="number-pad"
              returnKeyType="done"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>
              {t("bills.frequency")}
            </Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map((item) => (
                <Pressable
                  key={item.value}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: frequency === item.value ? accentGreen : pageBg,
                      borderColor,
                    },
                  ]}
                  onPress={() => handleFrequencyPress(item.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: frequency === item.value ? "#FFFFFF" : primaryColor },
                    ]}
                  >
                    {t(item.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>
              {t("bills.startDate")}
            </Text>
            <DateTimePicker
              value={startDate}
              mode="date"
              display="compact"
              onValueChange={(_event, date) => onStartDateChange(date)}
              style={styles.datePicker}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>
              {t("common.category")}
            </Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: category === item.id ? accentGreen : pageBg,
                      borderColor,
                    },
                  ]}
                  onPress={() => handleCategoryPress(item.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: category === item.id ? "#FFFFFF" : primaryColor },
                    ]}
                  >
                    {getCategoryLabel(item, locale)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: accentGreen, opacity: isSaving || !canSubmit ? 0.5 : 1 },
          ]}
          onPress={handleSave}
          disabled={isSaving || !canSubmit}
        >
          <Text style={styles.saveButtonText}>
            {isEdit ? t("bills.saveChanges") : t("bills.add")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
