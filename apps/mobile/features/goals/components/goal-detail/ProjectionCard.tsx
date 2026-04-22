import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { GoalProjection } from "../../lib/derive";
import { buildGoalProjectionCopy, hasLowConfidenceProjection } from "./GoalDetail.helpers";
import { styles } from "./GoalDetail.styles";

export function ProjectionCard({ projection }: { readonly projection: GoalProjection }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const projectionCopy = buildGoalProjectionCopy(projection);

  return (
    <View
      style={[
        styles.projectionCard,
        { backgroundColor: accentGreenLight },
        hasLowConfidenceProjection(projection)
          ? { borderWidth: 1.5, borderColor: accentGreen, borderStyle: "dashed" }
          : undefined,
      ]}
    >
      <Text style={[styles.projectionText, { color: accentGreen }]}>
        {t(projectionCopy.key, "values" in projectionCopy ? projectionCopy.values : undefined)}
      </Text>
    </View>
  );
}
