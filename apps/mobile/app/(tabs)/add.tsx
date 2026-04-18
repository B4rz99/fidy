import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { useOptionalUserId } from "@/features/auth";
import {
  CATEGORIES,
  CategoryPill,
  getDateLabel,
  handleNumpadPress,
  saveCurrentTransaction,
  TypeToggle,
  updateCurrentTransaction,
  useTransactionStore,
} from "@/features/transactions";
import { FidyNumpad } from "@/shared/components";
import { Calendar } from "@/shared/components/icons";
import { Platform, Pressable, Text, TextInput, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useBlinkingCursor, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatInputDisplay, parseDigitsToAmount, trackTransactionCreated } from "@/shared/lib";

export default function AddTransactionScreen() {
  const { navigate } = useRouter();
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { bottom: safeBottom } = useSafeAreaInsets();
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
      resetForm: s.resetForm,
    }))
  );

  const isEditing = editingId != null;

  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  const amountColor = type === "expense" ? accentRed : accentGreen;
  const displayAmount = digits.length > 0 ? formatInputDisplay(digits) : "$";
  const canSave = parseDigitsToAmount(digits) > 0;
  const buttonBg = canSave ? accentGreen : "#CCCCCC";
  const dateLabel = useMemo(
    () => getDateLabel(date, new Date(), t("dates.today"), getDateFnsLocale(locale)),
    [date, t, locale]
  );

  const digitsRef = useRef(digits);
  digitsRef.current = digits;

  const { cursorStyle } = useBlinkingCursor();

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  const handleSave = () => {
    void guardedSave(async () => {
      if (!db || !userId) return;
      const result = isEditing
        ? await updateCurrentTransaction(db, userId, editingId)
        : await saveCurrentTransaction(db, userId);
      if (result.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!isEditing) {
          trackTransactionCreated({
            type,
            category: String(categoryId ?? ""),
            source: "manual",
          });
          resetForm();
        }
        navigate("/(tabs)" as never);
      }
    });
  };

  const handleKey = useCallback(
    (key: string) => {
      setDigits(handleNumpadPress(digitsRef.current, key));
    },
    [setDigits]
  );

  const saveLabel = isEditing ? t("common.save") : t("transactions.saveTransaction");

  return (
    <View style={{ flex: 1 }} className="bg-page dark:bg-page-dark">
      {/* Top zone: amount display + metadata */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 12 }}>
        {/* Type toggle + Amount */}
        <View style={{ alignItems: "center", gap: 4 }}>
          <TypeToggle value={type} onChange={setType} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 40,
                color: amountColor,
              }}
            >
              {displayAmount}
            </Text>
            <Animated.View
              style={[
                {
                  width: 2,
                  height: 32,
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
        <View style={{ alignItems: "center", gap: 6 }}>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}
          >
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
      </View>

      {/* Bottom zone: save button + numpad, pinned to bottom */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? safeBottom : 16,
          gap: 8,
        }}
      >
        {/* Save button */}
        <Pressable
          style={{
            height: 48,
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
              fontSize: 15,
              color: "#FFFFFF",
            }}
          >
            {saveLabel}
          </Text>
        </Pressable>

        {/* Custom numpad */}
        <FidyNumpad onKeyPress={handleKey} />
      </View>
    </View>
  );
}
