import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { Calendar, ChevronLeft } from "@/shared/components/icons";
import { Pressable, Text, TextInput, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatInputDisplay, trackTransactionCreated } from "@/shared/lib";
import { CATEGORIES } from "../lib/categories";
import { getDateLabel } from "../lib/format-date";
import { useTransactionStore } from "../store";
import { CategoryPill } from "./CategoryPill";

export const TransactionDetails = () => {
  const { back } = useRouter();
  const { t, locale } = useTranslation();
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
  const displayAmount = formatInputDisplay(digits);
  const dateLabel = getDateLabel(date, new Date(), t("dates.today"), getDateFnsLocale(locale));

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = () =>
    guardedSave(async () => {
      const result = await saveTransaction();
      if (result.success) {
        trackTransactionCreated({
          type,
          category: String(categoryId ?? ""),
          source: "manual",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetForm();
        back();
      }
    });

  return (
    <View className="gap-4">
      {/* Amount display — tap to go back */}
      <Pressable
        className="flex-row items-center justify-center gap-2"
        onPress={() => setStep(1)}
        accessibilityRole="button"
        accessibilityLabel={t("common.amount")}
      >
        <ChevronLeft size={24} color={amountColor} />
        <Text className="font-poppins-bold text-[28px]" style={{ color: amountColor }}>
          {displayAmount}
        </Text>
      </Pressable>

      {/* Category section */}
      <View className="gap-3">
        <Text className="font-poppins-medium text-[13px]" style={{ color: secondary }}>
          {t("common.category")}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              category={cat}
              isSelected={categoryId === cat.id}
              onPress={() => setCategoryId(cat.id)}
            />
          ))}
        </View>
      </View>

      {/* Description input */}
      <TextInput
        className="h-12 rounded-xl px-4 font-poppins-medium text-[14px]"
        style={{
          color: primary,
          borderWidth: 1,
          borderColor: borderSubtle,
        }}
        placeholder={t("transactions.descriptionOptional")}
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

      {/* Save button */}
      <View>
        <Pressable
          className="h-[52px] w-full items-center justify-center rounded-xl"
          style={{ backgroundColor: accentGreen, opacity: isSaving ? 0.5 : 1 }}
          onPress={handleSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={t("transactions.saveTransaction")}
        >
          <Text className="font-poppins-semibold text-section text-white">
            {t("transactions.saveTransaction")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
