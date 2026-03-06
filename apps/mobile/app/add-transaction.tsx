import { useEffect } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { AmountEntry } from "@/features/transactions/components/AmountEntry";
import { TransactionDetails } from "@/features/transactions/components/TransactionDetails";
import { useTransactionStore } from "@/features/transactions/store";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

export default function AddTransactionModal() {
  const step = useTransactionStore((s) => s.step);
  const resetForm = useTransactionStore((s) => s.resetForm);

  useEffect(() => {
    resetForm();
  }, [resetForm]);
  const cardColor = useThemeColor("card");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cardColor,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 32,
      }}
    >
      <Animated.View
        key={step}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={{ flex: 1 }}
      >
        {step === 1 ? <AmountEntry /> : <TransactionDetails />}
      </Animated.View>
    </View>
  );
}
