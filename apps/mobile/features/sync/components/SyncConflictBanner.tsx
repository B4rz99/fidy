import { ChevronRight, GitMerge } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useSyncConflictStore } from "../store";

type SyncConflictBannerProps = {
  readonly onPress: () => void;
};

export const SyncConflictBanner = ({ onPress }: SyncConflictBannerProps) => {
  const count = useSyncConflictStore((s) => s.conflictCount);
  const peachBg = useThemeColor("peachLight");
  const accentRed = useThemeColor("accentRed");
  const secondaryColor = useThemeColor("secondary");

  if (count === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-xl p-3"
      style={{ backgroundColor: peachBg, gap: 12 }}
    >
      <View className="flex-1 flex-row items-center" style={{ gap: 10 }}>
        <GitMerge size={18} color={accentRed} />
        <View>
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {count} sync {count === 1 ? "conflict needs" : "conflicts need"} review
          </Text>
          <Text className="font-poppins-medium text-caption" style={{ color: secondaryColor }}>
            Changes from another device
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={secondaryColor} />
    </Pressable>
  );
};
