import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FidyNumpad } from "@/shared/components";
import { Calendar, Mic, X } from "@/shared/components/icons";
import { Keyboard, Platform, Pressable, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatInputDisplay, parseDigitsToAmount } from "@/shared/lib";
import type { CategoryId } from "@/shared/types/branded";
import { CATEGORIES } from "../lib/categories";
import { getDateLabel } from "../lib/format-date";
import { handleNumpadPress } from "../lib/handle-numpad-press";
import type { TransactionType } from "../schema";
import { CategoryPill } from "./CategoryPill";
import { TypeToggle } from "./TypeToggle";

type TransactionFormProps = {
  readonly type: TransactionType;
  readonly digits: string;
  readonly categoryId: CategoryId | null;
  readonly description: string;
  readonly date: Date;
  readonly saveLabel: string;
  readonly isSaving: boolean;
  readonly onTypeChange: (type: TransactionType) => void;
  readonly onDigitsChange: (digits: string) => void;
  readonly onCategoryChange: (id: CategoryId) => void;
  readonly onDescriptionChange: (text: string) => void;
  readonly onSave: () => void;
  readonly onDelete?: () => void;
  readonly onClose?: () => void;
  readonly onVoicePress?: () => void;
};

export function TransactionForm({
  type,
  digits,
  categoryId,
  description,
  date,
  saveLabel,
  isSaving,
  onTypeChange,
  onDigitsChange,
  onCategoryChange,
  onDescriptionChange,
  onSave,
  onDelete,
  onClose,
  onVoicePress,
}: TransactionFormProps) {
  const { t, locale } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();

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

  const [descriptionFocused, setDescriptionFocused] = useState(false);

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
    return () => cancelAnimation(cursorOpacity);
  }, [cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const handleKey = useCallback(
    (key: string) => {
      onDigitsChange(handleNumpadPress(digitsRef.current, key));
    },
    [onDigitsChange]
  );

  return (
    <Pressable style={{ flex: 1 }} className="bg-page dark:bg-page-dark" onPress={Keyboard.dismiss}>
      {/* Close button (edit mode only) */}
      {onClose && (
        <View style={{ alignItems: "flex-end", paddingTop: 12, paddingHorizontal: 16 }}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <X size={24} color={secondary} />
          </Pressable>
        </View>
      )}

      {/* Top zone: amount display + metadata */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 12 }}>
        {/* Type toggle + Amount */}
        <View style={{ alignItems: "center", gap: 4 }}>
          <TypeToggle value={type} onChange={onTypeChange} />
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
            {!descriptionFocused && (
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
            )}
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
                onPress={() => onCategoryChange(cat.id)}
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
            onChangeText={onDescriptionChange}
            onFocus={() => setDescriptionFocused(true)}
            onBlur={() => setDescriptionFocused(false)}
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
          {onVoicePress && (
            <Pressable
              onPress={onVoicePress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("voice.listening")}
              style={{
                height: 36,
                width: 36,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: borderSubtle,
              }}
            >
              <Mic size={16} color={accentGreen} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Bottom zone: buttons + numpad, pinned to bottom */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? safeBottom : 16,
          gap: 8,
        }}
      >
        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {onDelete && (
            <Pressable
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: `${accentRed}18`,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 20,
              }}
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={t("transactions.deleteTransaction")}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 15,
                  color: accentRed,
                }}
              >
                {t("transactions.deleteTransaction")}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              backgroundColor: buttonBg,
              alignItems: "center",
              justifyContent: "center",
              opacity: isSaving ? 0.5 : 1,
            }}
            onPress={canSave ? onSave : undefined}
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
        </View>

        {/* Custom numpad */}
        <FidyNumpad onKeyPress={handleKey} />
      </View>
    </Pressable>
  );
}
