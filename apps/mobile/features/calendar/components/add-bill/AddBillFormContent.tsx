import { useState } from "react";
import type { TextInput as RNTextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TransactionDatePickerDialog } from "@/features/transactions/display.public";
import { CATEGORIES, type CategoryId } from "@/shared/categories";
import { AppAuroraBackground, Button, FormTextField, SelectableChipRow } from "@/shared/components";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useColorScheme, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { type BillFrequency, FREQUENCIES } from "../../schema";
import { styles } from "./AddBillForm.styles";

type AddBillFormContentProps = {
  readonly amount: string;
  readonly amountRef: React.RefObject<RNTextInput | null>;
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
  const isDark = useColorScheme() === "dark";
  const borderColor = useThemeColor("borderSubtle");
  const pageBg = useThemeColor("page");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const formattedStartDate = startDate.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: pageBg }]}
      behavior="padding"
    >
      <AppAuroraBackground isDark={isDark} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.formGrid}>
          <FormTextField
            label={t("common.name")}
            value={name}
            onChangeText={onNameChange}
            placeholder="Netflix"
            returnKeyType="next"
            onSubmitEditing={() => amountRef.current?.focus()}
            style={styles.inputGroup}
            labelStyle={[styles.inputLabel, { color: secondaryColor }]}
            inputStyle={[
              styles.input,
              { backgroundColor: pageBg, borderColor, color: primaryColor },
            ]}
          />

          <FormTextField
            ref={amountRef}
            label={t("common.amount")}
            value={amount}
            onChangeText={onAmountChange}
            placeholder="50000"
            keyboardType="number-pad"
            returnKeyType="done"
            style={styles.inputGroup}
            labelStyle={[styles.inputLabel, { color: secondaryColor }]}
            inputStyle={[
              styles.input,
              { backgroundColor: pageBg, borderColor, color: primaryColor },
            ]}
          />

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>
              {t("bills.frequency")}
            </Text>
            <SelectableChipRow
              className="flex-wrap"
              options={FREQUENCIES.map((item) => ({
                value: item.value,
                label: t(item.labelKey),
              }))}
              value={frequency}
              onChange={handleFrequencyPress}
              chipClassName="h-auto rounded-full px-4 py-2"
            />
          </View>

          <Pressable
            style={styles.inputGroup}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
          >
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>
              {t("bills.startDate")}
            </Text>
            <View
              style={[styles.input, styles.dateInput, { backgroundColor: pageBg, borderColor }]}
            >
              <Text style={[styles.dateText, { color: primaryColor }]}>{formattedStartDate}</Text>
            </View>
          </Pressable>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>
              {t("common.category")}
            </Text>
            <SelectableChipRow
              className="flex-wrap"
              options={CATEGORIES.map((item) => ({
                value: item.id,
                label: getCategoryLabel(item, locale),
              }))}
              value={category}
              onChange={handleCategoryPress}
              chipClassName="h-auto rounded-full px-4 py-2"
            />
          </View>
        </View>

        <Button
          label={isEdit ? t("bills.saveChanges") : t("bills.add")}
          onPress={handleSave}
          disabled={isSaving || !canSubmit}
          loading={isSaving}
        />
      </ScrollView>
      <TransactionDatePickerDialog
        allowFuture
        date={startDate}
        onChange={onStartDateChange}
        onClose={() => setShowDatePicker(false)}
        visible={showDatePicker}
      />
    </KeyboardAvoidingView>
  );
}
