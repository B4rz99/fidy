import { useCallback, useRef, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useShallow } from "zustand/react/shallow";
import { Pressable, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { cleanDigitInput, formatInputDisplay, parseDigitsToAmount } from "~/shared/lib/format-money";
import { useTransactionStore } from "../store";
import { TypeToggle } from "./TypeToggle";

export const AmountEntry = () => {
  const { type, digits, setType, setDigits, setStep } = useTransactionStore(
    useShallow((s) => ({
      type: s.type,
      digits: s.digits,
      setType: s.setType,
      setDigits: s.setDigits,
      setStep: s.setStep,
    }))
  );
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const cursorOpacity = useSharedValue(0);

  const startBlink = useCallback(() => {
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

  const stopBlink = useCallback(() => {
    cursorOpacity.value = withTiming(0, { duration: 100 });
  }, [cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const amountColor = type === "expense" ? accentRed : accentGreen;
  const hasDigits = digits.length > 0;
  const displayAmount = hasDigits ? formatInputDisplay(digits) : isFocused ? "$" : "$0";
  const canProceed = parseDigitsToAmount(digits) > 0;
  const buttonBg = canProceed ? accentGreen : "#CCCCCC";

  const handleChangeText = (text: string) => {
    setDigits(cleanDigitInput(text));
  };

  const handleFocus = () => {
    setIsFocused(true);
    startBlink();
  };

  const handleBlur = () => {
    setIsFocused(false);
    stopBlink();
  };

  return (
    <View className="items-center gap-4">
      <TypeToggle value={type} onChange={setType} />

      <Pressable
        onPress={() => inputRef.current?.focus()}
        className="flex-row items-center justify-center py-4"
      >
        <Text className="font-poppins-bold text-[40px]" style={{ color: amountColor }}>
          {displayAmount}
        </Text>
        {isFocused && (
          <Animated.View
            style={[
              {
                width: 2,
                height: 36,
                marginLeft: 2,
                borderRadius: 1,
                backgroundColor: amountColor,
              },
              cursorStyle,
            ]}
          />
        )}
      </Pressable>

      {/* Hidden input to trigger native keyboard — user taps amount to focus */}
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="number-pad"
        caretHidden
        autoCorrect={false}
        style={{ position: "absolute", opacity: 0, height: 0 }}
      />

      <View className="w-full">
        <Pressable
          className="h-[52px] w-full items-center justify-center rounded-xl"
          style={{ backgroundColor: buttonBg }}
          onPress={() => canProceed && setStep(2)}
          disabled={!canProceed}
          accessibilityRole="button"
          accessibilityLabel="Next"
        >
          <Text className="font-poppins-semibold text-section text-white">Next</Text>
        </Pressable>
      </View>
    </View>
  );
};
