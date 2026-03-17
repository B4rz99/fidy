import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type ComingSoonScreenProps = {
  // biome-ignore lint/style/useNamingConvention: PascalCase required for React component prop
  Icon: LucideIcon;
  headerTitle: string;
  headline: string;
  description: string;
};

export function ComingSoonScreen({
  Icon,
  headerTitle,
  headline,
  description,
}: ComingSoonScreenProps) {
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor("accentGreen");

  return (
    <View className="flex-1 bg-page dark:bg-page-dark" style={{ paddingTop: insets.top }}>
      <View className="px-4 pb-2">
        <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
          {headerTitle}
        </Text>
      </View>

      <View className="flex-1 items-center justify-center gap-4 px-4">
        <View style={{ opacity: 0.4 }}>
          <Icon size={64} color={iconColor} />
        </View>

        <Text className="text-center font-poppins-semibold text-title text-primary dark:text-primary-dark">
          {headline}
        </Text>

        <Text className="w-[280px] text-center font-poppins-medium text-body text-secondary dark:text-secondary-dark">
          {description}
        </Text>

        <View className="h-8 items-center justify-center rounded-full bg-accent-green px-4 dark:bg-accent-green-dark">
          <Text className="font-poppins-semibold text-caption tracking-wider text-white">
            COMING SOON
          </Text>
        </View>
      </View>
    </View>
  );
}
