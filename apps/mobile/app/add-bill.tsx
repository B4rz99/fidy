import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
} from "react-native";
import type { BillFrequency } from "@/features/calendar/schema";
import { FREQUENCIES } from "@/features/calendar/schema";
import { useCalendarStore } from "@/features/calendar/store";
import type { CategoryId } from "@/features/transactions/lib/categories";
import { CATEGORIES } from "@/features/transactions/lib/categories";
import { centsToDisplay } from "@/features/transactions/lib/format-amount";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

export default function AddBillScreen() {
  const router = useRouter();
  const { billId } = useLocalSearchParams<{ billId?: string }>();
  const bills = useCalendarStore((s) => s.bills);
  const addBill = useCalendarStore((s) => s.addBill);
  const updateBillAction = useCalendarStore((s) => s.updateBill);

  const existingBill = billId ? bills.find((b) => b.id === billId) : undefined;
  const isEdit = !!existingBill;

  const [name, setName] = useState(existingBill?.name ?? "");
  const [amount, setAmount] = useState(
    existingBill ? centsToDisplay(existingBill.amountCents).replace("$", "") : ""
  );
  const [frequency, setFrequency] = useState<BillFrequency>(existingBill?.frequency ?? "monthly");
  const [category, setCategory] = useState<CategoryId>(
    (existingBill?.categoryId as CategoryId) ?? "services"
  );
  const [startDate, setStartDate] = useState(existingBill?.startDate ?? new Date());

  const amountRef = useRef<TextInput>(null);

  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const pageBg = useThemeColor("page");

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-sync when the bill identity changes
  useEffect(() => {
    if (existingBill) {
      setName(existingBill.name);
      setAmount(centsToDisplay(existingBill.amountCents).replace("$", ""));
      setFrequency(existingBill.frequency);
      setCategory(existingBill.categoryId as CategoryId);
      setStartDate(existingBill.startDate);
    }
  }, [existingBill?.id]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (isEdit && existingBill) {
      const cents = Math.round(parseFloat(amount.replace(/,/g, "")) * 100);
      if (Number.isNaN(cents) || cents <= 0) return;
      await updateBillAction(existingBill.id, {
        name: trimmedName,
        amountCents: cents,
        frequency,
        categoryId: category,
        startDate,
      });
      router.back();
    } else {
      const success = await addBill(trimmedName, amount, frequency, category, startDate);
      if (success) router.back();
    }
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
          {isEdit ? "Edit Bill" : "Add Bill"}
        </Text>

        <View style={styles.formGrid}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>Name</Text>
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
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>Amount</Text>
            <TextInput
              ref={amountRef}
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="9.99"
              placeholderTextColor={secondaryColor}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>Frequency</Text>
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
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>Start Date</Text>
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
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>Category</Text>
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
                    {c.label.en}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, { backgroundColor: accentGreen }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>{isEdit ? "Save Changes" : "Add"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
