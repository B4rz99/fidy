import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { type Bill, type BillFrequency, FREQUENCIES, useCalendarStore } from "@/features/calendar";
import { CATEGORIES, type CategoryId, isValidCategoryId } from "@/features/transactions";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { parseDigitsToAmount } from "@/shared/lib";
import type { BillId } from "@/shared/types/branded";

function AddBillForm({
  existingBill,
  onAddBill,
  onUpdateBill,
  onDone,
}: {
  readonly existingBill: Bill | undefined;
  readonly onAddBill: (
    name: string,
    amount: string,
    frequency: BillFrequency,
    categoryId: CategoryId,
    startDate: Date
  ) => Promise<boolean>;
  readonly onUpdateBill: (
    id: BillId,
    data: Partial<
      Pick<Bill, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
    >
  ) => Promise<void>;
  readonly onDone: () => void;
}) {
  const { t, locale } = useTranslation();
  const isEdit = !!existingBill;

  const [name, setName] = useState(existingBill?.name ?? "");
  const [amount, setAmount] = useState(existingBill ? String(existingBill.amount) : "");
  const [frequency, setFrequency] = useState<BillFrequency>(existingBill?.frequency ?? "monthly");
  const [category, setCategory] = useState<CategoryId>(
    existingBill?.categoryId && isValidCategoryId(existingBill.categoryId)
      ? existingBill.categoryId
      : ("services" as CategoryId)
  );
  const [startDate, setStartDate] = useState(existingBill?.startDate ?? new Date());

  const amountRef = useRef<TextInput>(null);

  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const pageBg = useThemeColor("page");

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = () => {
    void guardedSave(async () => {
      const trimmedName = name.trim();
      if (!trimmedName) return;

      if (isEdit) {
        const amountValue = parseDigitsToAmount(amount);
        if (amountValue <= 0) return;
        await onUpdateBill(existingBill.id as BillId, {
          name: trimmedName,
          amount: amountValue,
          frequency,
          categoryId: category,
          startDate,
        });
        onDone();
      } else {
        const success = await onAddBill(trimmedName, amount, frequency, category, startDate);
        if (success) onDone();
      }
    });
  };

  const handleFrequencyPress = (value: BillFrequency) => {
    Keyboard.dismiss();
    setFrequency(value);
  };

  const handleCategoryPress = (id: CategoryId) => {
    Keyboard.dismiss();
    setCategory(id);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: cardBg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: primaryColor }]}>
          {isEdit ? t("bills.editBill") : t("bills.addBill")}
        </Text>

        <View style={styles.formGrid}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>{t("common.name")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              value={name}
              onChangeText={setName}
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
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
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
              {FREQUENCIES.map((f) => (
                <Pressable
                  key={f.value}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: frequency === f.value ? accentGreen : pageBg,
                      borderColor,
                    },
                  ]}
                  onPress={() => handleFrequencyPress(f.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: frequency === f.value ? "#FFFFFF" : primaryColor },
                    ]}
                  >
                    {t(f.labelKey)}
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
              onChange={(_event, date) => {
                if (date) setStartDate(date);
              }}
              style={styles.datePicker}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>
              {t("common.category")}
            </Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: category === c.id ? accentGreen : pageBg,
                      borderColor,
                    },
                  ]}
                  onPress={() => handleCategoryPress(c.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: category === c.id ? "#FFFFFF" : primaryColor },
                    ]}
                  >
                    {getCategoryLabel(c, locale)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, { backgroundColor: accentGreen, opacity: isSaving ? 0.5 : 1 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isEdit ? t("bills.saveChanges") : t("bills.add")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function AddBillScreen() {
  const router = useRouter();
  const { billId } = useLocalSearchParams<{ billId?: string }>();
  const bills = useCalendarStore((s) => s.bills);
  const addBill = useCalendarStore((s) => s.addBill);
  const updateBill = useCalendarStore((s) => s.updateBill);

  const existingBill = billId ? bills.find((b) => b.id === billId) : undefined;

  return (
    <AddBillForm
      key={existingBill?.id ?? "new"}
      existingBill={existingBill}
      onAddBill={addBill}
      onUpdateBill={updateBill}
      onDone={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  formGrid: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  input: {
    borderRadius: 10,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    minHeight: 44,
  },
  datePicker: {
    alignSelf: "flex-start",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: "center",
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  saveButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  saveButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
