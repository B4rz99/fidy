import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Calendar, ChevronLeft } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { CATEGORY_ROW_KEYS, CATEGORY_ROWS } from "../lib/categories";
import { formatAmount } from "../lib/format-amount";
import { getDateLabel } from "../lib/format-date";
import { useTransactionStore } from "../store";
import { CategoryPill } from "./CategoryPill";

export const TransactionDetails = () => {
  const { back } = useRouter();
  const {
    type,
    digits,
    categoryId,
    description,
    date,
    setStep,
    setCategoryId,
    setDescription,
    saveTransaction,
    resetForm,
  } = useTransactionStore(
    useShallow((s) => ({
      type: s.type,
      digits: s.digits,
      categoryId: s.categoryId,
      description: s.description,
      date: s.date,
      setStep: s.setStep,
      setCategoryId: s.setCategoryId,
      setDescription: s.setDescription,
      saveTransaction: s.saveTransaction,
      resetForm: s.resetForm,
    }))
  );

  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  const amountColor = type === "expense" ? accentRed : accentGreen;
  const displayAmount = formatAmount(digits);
  const dateLabel = getDateLabel(date);

  const handleSave = async () => {
    const result = await saveTransaction();
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      back();
    }
  };

  return (
    <View className="flex-1 gap-4">
      {/* Amount display — tap to go back */}
      <Pressable
        className="flex-row items-center justify-center gap-2"
        onPress={() => setStep(1)}
        accessibilityRole="button"
        accessibilityLabel="Edit amount"
      >
        <ChevronLeft size={24} color={amountColor} />
        <Text className="font-poppins-bold text-[28px]" style={{ color: amountColor }}>
          {displayAmount}
        </Text>
      </Pressable>

      {/* Category section */}
      <View className="gap-3">
        <Text className="font-poppins-medium text-[13px]" style={{ color: secondary }}>
          Category
        </Text>
        {CATEGORY_ROWS.map((row, i) => (
          <View key={CATEGORY_ROW_KEYS[i]} className="flex-row gap-2">
            {row.map((cat) => (
              <CategoryPill
                key={cat.id}
                category={cat}
                isSelected={categoryId === cat.id}
                onPress={() => setCategoryId(cat.id)}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Description input */}
      <TextInput
        className="h-12 rounded-xl px-4 font-poppins-medium text-[14px]"
        style={{
          color: primary,
          borderWidth: 1,
          borderColor: borderSubtle,
        }}
        placeholder="Add a description (optional)"
        placeholderTextColor={tertiary}
        value={description}
        onChangeText={setDescription}
        maxLength={200}
      />

      {/* Date row */}
      <View className="flex-row items-center gap-2.5 px-1">
        <Calendar size={20} color={secondary} />
        <Text className="font-poppins-medium text-[14px]" style={{ color: primary }}>
          {dateLabel}
        </Text>
      </View>

      {/* Save button pushed to bottom */}
      <View className="mt-auto">
        <Pressable
          className="h-[52px] w-full items-center justify-center rounded-xl"
          style={{ backgroundColor: accentGreen }}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save Transaction"
        >
          <Text className="font-poppins-semibold text-section text-white">Save Transaction</Text>
        </Pressable>
      </View>
    </View>
  );
};
