import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { CategoryId } from "@/features/transactions/lib/categories";
import { CATEGORIES } from "@/features/transactions/lib/categories";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import type { BillFrequency } from "../schema";
import { useCalendarStore } from "../store";
import { PopupOverlay } from "./PopupOverlay";

const FREQUENCIES: { value: BillFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function AddBillPopup() {
  const popup = useCalendarStore((s) => s.popup);
  const closePopup = useCalendarStore((s) => s.closePopup);
  const addBill = useCalendarStore((s) => s.addBill);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<BillFrequency>("monthly");
  const [category, setCategory] = useState<CategoryId>("services");

  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const pageBg = useThemeColor("page");

  if (popup !== "addBill") return null;

  const handleAdd = () => {
    const success = addBill(name, amount, frequency, category);
    if (!success) return;
    setName("");
    setAmount("");
    setFrequency("monthly");
    setCategory("services");
  };

  return (
    <PopupOverlay onClose={closePopup}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.title, { color: primaryColor }]}>Add Bill</Text>

        <View style={styles.formGrid}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              value={name}
              onChangeText={setName}
              placeholder="Netflix"
              placeholderTextColor={secondaryColor}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: secondaryColor }]}>Amount</Text>
            <TextInput
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="9.99"
              placeholderTextColor={secondaryColor}
              keyboardType="decimal-pad"
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
                  onPress={() => setFrequency(f.value)}
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
                  onPress={() => setCategory(c.id)}
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

        <Pressable style={[styles.addButton, { backgroundColor: accentGreen }]} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </PopupOverlay>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 345,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
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
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  addButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
  },
  addButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
