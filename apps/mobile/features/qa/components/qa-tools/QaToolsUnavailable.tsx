import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./QaTools.styles";

export function QaToolsUnavailable() {
  const { t } = useTranslation();
  const secondary = useThemeColor("secondary");

  return (
    <View style={styles.centeredContainer}>
      <Text style={[styles.primaryValueText, { color: secondary }]}>
        {t("qaTools.unavailable")}
      </Text>
    </View>
  );
}
