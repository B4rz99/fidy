import { ChevronRight, GitMerge } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useSyncConflictStore } from "../store";

type SyncConflictBannerProps = {
  readonly onPress: () => void;
};

export const SyncConflictBanner = ({ onPress }: SyncConflictBannerProps) => {
  const { t } = useTranslation();
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
            {t("syncConflicts.count", { count })}
          </Text>
          <Text className="font-poppins-medium text-caption" style={{ color: secondaryColor }}>
            {t("syncConflicts.changesFromDevice")}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={secondaryColor} />
    </Pressable>
  );
};
