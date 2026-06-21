import { useState } from "react";
import { useAvailableCategories } from "@/features/categories/hooks.public";
import { CategoryStrip, TransactionDatePickerDialog } from "@/features/transactions/ui.public";
import type { CategoryId } from "@/shared/categories";
import {
  Button,
  MoneyAmountDisplay,
  MoneyEntryDateButton,
  MoneyEntryScreen,
  MoneyEntryTextField,
  SelectableChipRow,
} from "@/shared/components";
import { Calendar, Pencil } from "@/shared/components/icons";
import { Keyboard, Pressable, Text, View } from "@/shared/components/rn";
import { useBlinkingCursor, useThemeColor, useTranslation } from "@/shared/hooks";
import { type BillFrequency, FREQUENCIES } from "../../schema";
import { styles } from "./AddBillForm.styles";

type AddBillFormContentProps = {
  readonly amount: string;
  readonly canSubmit: boolean;
  readonly category: CategoryId;
  readonly frequency: BillFrequency;
  readonly handleAmountKey: (key: string) => void;
  readonly handleCategoryPress: (id: CategoryId) => void;
  readonly handleFrequencyPress: (value: BillFrequency) => void;
  readonly handleSave: () => void;
  readonly headerTitle: string;
  readonly isEdit: boolean;
  readonly isSaving: boolean;
  readonly name: string;
  readonly onNameChange: (value: string) => void;
  readonly onStartDateChange: (date: Date) => void;
  readonly startDate: Date;
};

export function AddBillFormContent({
  amount,
  canSubmit,
  category,
  frequency,
  handleAmountKey,
  handleCategoryPress,
  handleFrequencyPress,
  handleSave,
  headerTitle,
  isEdit,
  isSaving,
  name,
  onNameChange,
  onStartDateChange,
  startDate,
}: AddBillFormContentProps) {
  const { t, locale } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const { cursorStyle } = useBlinkingCursor();
  const [numpadActive, setNumpadActive] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const categories = useAvailableCategories();
  const formattedStartDate = startDate.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <MoneyEntryScreen
        amountContent={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.amount")}
            onPress={() => {
              Keyboard.dismiss();
              setShowDatePicker(false);
              setNumpadActive(true);
            }}
            style={styles.amountPressTarget}
          >
            <MoneyAmountDisplay
              color={primaryColor}
              cursorStyle={cursorStyle}
              cursorVisible={numpadActive}
              digits={amount}
              emptyDisplay="$0"
              size="hero"
            />
          </Pressable>
        }
        amountStyle={styles.amountZone}
        actionContent={
          <Button
            label={isEdit ? t("bills.saveChanges") : t("bills.add")}
            onPress={handleSave}
            disabled={isSaving || !canSubmit}
            loading={isSaving}
            size="compact"
          />
        }
        detailContent={
          <>
            <View style={styles.firstDetailRow}>
              <MoneyEntryTextField
                icon={Pencil}
                label={t("common.name")}
                value={name}
                onChangeText={onNameChange}
                onFocus={() => setNumpadActive(false)}
                onBlur={() => setNumpadActive(true)}
                placeholder={t("bills.placeholder.name")}
                style={[styles.inputGroup, styles.nameField]}
                returnKeyType="done"
              />

              <MoneyEntryDateButton
                icon={Calendar}
                label={t("bills.startDate")}
                value={formattedStartDate}
                style={[styles.inputGroup, styles.startDateField]}
                onPress={() => {
                  Keyboard.dismiss();
                  setNumpadActive(true);
                  setShowDatePicker(true);
                }}
              />
            </View>

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
                chipStyle={{ minHeight: 32, paddingHorizontal: 16, paddingVertical: 8 }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: secondaryColor }]}>
                {t("common.category")}
              </Text>
              <View style={styles.categoryStrip}>
                <CategoryStrip
                  categories={categories}
                  categoryId={category}
                  onCategoryChange={handleCategoryPress}
                />
              </View>
            </View>
          </>
        }
        headerTitle={headerTitle}
        numpadVisible={numpadActive}
        onKeyPress={handleAmountKey}
        stackStyle={styles.formStack}
      />
      <TransactionDatePickerDialog
        allowFuture
        date={startDate}
        onChange={onStartDateChange}
        onClose={() => {
          setShowDatePicker(false);
          setNumpadActive(true);
        }}
        visible={showDatePicker}
      />
    </>
  );
}
