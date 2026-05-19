import { ProgressBar } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./SyncProgressStep.styles";

type SyncImportProgressProps = {
  readonly importComplete: boolean;
  readonly isWaiting: boolean;
  readonly savedCount: number;
  readonly percent: number;
};

export function SyncImportProgress({
  importComplete,
  isWaiting,
  savedCount,
  percent,
}: SyncImportProgressProps) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");

  return (
    <View style={styles.progressSection}>
      <ProgressBar
        percent={percent}
        height={10}
        completeTone="success"
        shimmering={isWaiting && !importComplete}
      />
      <Text style={[styles.counter, { color: accentGreen }]}>
        {t("onboarding.syncing.transactionsFound", { count: savedCount })}
      </Text>
    </View>
  );
}
