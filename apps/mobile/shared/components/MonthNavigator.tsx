import { ChevronLeft, ChevronRight } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { IconActionButton } from "./IconActionButton";

type MonthNavigatorProps = {
  readonly label: string;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly previousAccessibilityLabel: string;
  readonly nextAccessibilityLabel: string;
  readonly previousAccessibilityHint?: string;
  readonly nextAccessibilityHint?: string;
  readonly className?: string;
};

export function MonthNavigator({
  label,
  onPrevious,
  onNext,
  previousAccessibilityLabel,
  nextAccessibilityLabel,
  previousAccessibilityHint,
  nextAccessibilityHint,
  className,
}: MonthNavigatorProps) {
  const primaryColor = useThemeColor("primary");

  return (
    <View className={`flex-row items-center justify-center gap-2 ${className ?? ""}`}>
      <IconActionButton
        accessibilityHint={previousAccessibilityHint}
        accessibilityLabel={previousAccessibilityLabel}
        className="size-9"
        icon={<ChevronLeft size={22} color={primaryColor} />}
        onPress={onPrevious}
      />
      <Text
        className="min-w-[120px] text-center font-poppins-bold text-body text-text-primary dark:text-text-primary-dark"
        numberOfLines={1}
      >
        {label}
      </Text>
      <IconActionButton
        accessibilityHint={nextAccessibilityHint}
        accessibilityLabel={nextAccessibilityLabel}
        className="size-9"
        icon={<ChevronRight size={22} color={primaryColor} />}
        onPress={onNext}
      />
    </View>
  );
}

export type { MonthNavigatorProps };
