import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useShallow } from "zustand/react/shallow";
import {
  CATEGORIES,
  CategoryPill,
  digitsToCents,
  formatDollars,
  getDateLabel,
  handleNumpadPress,
  TypeToggle,
  useTransactionStore,
} from "@/features/transactions";
import { FidyNumpad, ScreenLayout } from "@/shared/components";
import { Calendar } from "@/shared/components/icons";
import { Pressable, ScrollView, Text, TextInput, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";

export default function AddTransactionScreen() {
  const { navigate } = useRouter();
  const { t, locale } = useTranslation();
  const {
    type,
    digits,
    categoryId,
    description,
    date,
    editingId,
    setType,
    setDigits,
    setCategoryId,
    setDescription,
    saveTransaction,
    updateTransaction,
    resetForm,
  } = useTransactionStore(
    useShallow((s) => ({
      type: s.type,
      digits: s.digits,
      categoryId: s.categoryId,
      description: s.description,
      date: s.date,
      editingId: s.editingId,
      setType: s.setType,
      setDigits: s.setDigits,
      setCategoryId: s.setCategoryId,
      setDescription: s.setDescription,
      saveTransaction: s.saveTransaction,
      updateTransaction: s.updateTransaction,
      resetForm: s.resetForm,
    }))
  );

  const isEditing = editingId != null;

  useEffect(() => {
    // Only reset form when entering add mode (not edit mode)
    if (!isEditing) {
      resetForm();
    }
  }, [resetForm, isEditing]);

  const cardColor = useThemeColor("card");
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  const amountColor = type === "expense" ? accentRed : accentGreen;
  const displayAmount = digits.length > 0 ? formatDollars(digits) : "$";
  const canSave = digitsToCents(digits) > 0;
  const buttonBg = canSave ? accentGreen : "#CCCCCC";
  const dateLabel = useMemo(
    () => getDateLabel(date, new Date(), t("dates.today"), getDateFnsLocale(locale)),
    [date, t, locale]
  );

  const digitsRef = useRef(digits);
  digitsRef.current = digits;

  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1, { duration: 530 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 530 })
      ),
      -1
    );
  }, [cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = () =>
    guardedSave(async () => {
      const result = isEditing ? await updateTransaction(editingId) : await saveTransaction();
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetForm();
        navigate("/(tabs)");
      }
    });

  const handleKey = useCallback(
    (key: string) => {
      setDigits(handleNumpadPress(digitsRef.current, key));
    },
    [setDigits]
  );

  const title = isEditing ? t("common.edit") : t("tabs.add");
  const saveLabel = isEditing ? t("common.save") : t("transactions.saveTransaction");

  return (
    <ScreenLayout title={title} variant="tab">
      <ScrollView
        style={{ flex: 1, backgroundColor: cardColor }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          gap: 8,
          paddingTop: 0,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type toggle + Amount */}
        <View style={{ alignItems: "center", gap: 2 }}>
          <TypeToggle value={type} onChange={setType} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 32,
                color: amountColor,
              }}
            >
              {displayAmount}
            </Text>
            <Animated.View
              style={[
                {
                  width: 2,
                  height: 28,
                  marginLeft: 2,
                  borderRadius: 1,
                  backgroundColor: amountColor,
                },
                cursorStyle,
              ]}
            />
          </View>
        </View>

        {/* Categories */}
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 12,
              color: secondary,
            }}
          >
            {t("common.category")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
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

        {/* Description + Date */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={{
              flex: 1,
              height: 36,
              borderRadius: 10,
              paddingHorizontal: 12,
              fontFamily: "Poppins_500Medium",
              fontSize: 12,
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
          <View
            style={{
              height: 36,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: borderSubtle,
            }}
          >
            <Calendar size={14} color={secondary} />
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                fontSize: 12,
                color: primary,
              }}
            >
              {dateLabel}
            </Text>
          </View>
        </View>

        {/* Save button */}
        <Pressable
          style={{
            height: 44,
            borderRadius: 12,
            backgroundColor: buttonBg,
            alignItems: "center",
            justifyContent: "center",
            opacity: isSaving ? 0.5 : 1,
          }}
          onPress={canSave ? handleSave : undefined}
          disabled={!canSave || isSaving}
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
        >
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 14,
              color: "#FFFFFF",
            }}
          >
            {saveLabel}
          </Text>
        </Pressable>

        {/* Custom numpad */}
        <FidyNumpad onKeyPress={handleKey} />
      </ScrollView>
    </ScreenLayout>
  );
}
