import { Card } from "@/shared/components";
import { Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { GoalProjection } from "../../lib/derive";
import { buildGoalProjectionCopy, hasLowConfidenceProjection } from "./GoalDetail.helpers";
import { styles } from "./GoalDetail.styles";

export function ProjectionCard({ projection }: { readonly projection: GoalProjection }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const projectionCopy = buildGoalProjectionCopy(projection);
  const isLowConfidence = hasLowConfidenceProjection(projection);

  return (
    <Card
      padded={false}
      radius={12}
      backgroundColor={accentGreenLight}
      borderColor={isLowConfidence ? accentGreen : undefined}
      borderWidth={isLowConfidence ? 1.5 : undefined}
      contentStyle={styles.projectionCard}
      surfaceStyle={isLowConfidence ? styles.projectionCardDashed : undefined}
    >
      <Text style={[styles.projectionText, { color: accentGreen }]}>
        {t(projectionCopy.key, "values" in projectionCopy ? projectionCopy.values : undefined)}
      </Text>
    </Card>
  );
}
