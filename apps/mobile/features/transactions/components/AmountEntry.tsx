import { useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { amountToCents, cleanDigitInput, formatAmount } from "../lib/format-amount";
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

  const amountColor = type === "expense" ? accentRed : accentGreen;
  const displayAmount = formatAmount(digits);
  const canProceed = amountToCents(digits) > 0;
  const buttonBg = canProceed ? accentGreen : "#CCCCCC";

  const handleChangeText = (text: string) => {
    setDigits(cleanDigitInput(text));
  };

  return (
    <View className="flex-1 items-center gap-4">
      <TypeToggle value={type} onChange={setType} />

      <Pressable onPress={() => inputRef.current?.focus()} className="py-4">
        <Text className="font-poppins-bold text-[40px]" style={{ color: amountColor }}>
          {displayAmount}
        </Text>
      </Pressable>

      {/* Hidden input to trigger native keyboard — user taps amount to focus */}
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        caretHidden
        autoCorrect={false}
        style={{ position: "absolute", opacity: 0, height: 0 }}
      />

      <View className="w-full mt-auto">
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
