// biome-ignore-all lint/suspicious/noArrayIndexKey: static dot indicators never reorder
import { StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type Props = {
  readonly currentStep: number;
  readonly totalSteps: number;
};

export function StepIndicator({ currentStep, totalSteps }: Props) {
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: i < currentStep ? accentGreen : borderColor }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
