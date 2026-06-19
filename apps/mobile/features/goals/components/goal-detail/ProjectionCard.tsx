import { Card } from "@/shared/components";
import { Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { GoalProjection } from "../../lib/derive";
import { buildGoalProjectionCopy } from "./GoalDetail.helpers";
import { styles } from "./GoalDetail.styles";

export function ProjectionCard({ projection }: { readonly projection: GoalProjection }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const projectionCopy = buildGoalProjectionCopy(projection);

  return (
    <Card padded={false} radius={12} contentStyle={styles.projectionCard}>
      <Text style={[styles.projectionText, { color: accentGreen }]}>
        {t(projectionCopy.key, "values" in projectionCopy ? projectionCopy.values : undefined)}
      </Text>
    </Card>
  );
}
