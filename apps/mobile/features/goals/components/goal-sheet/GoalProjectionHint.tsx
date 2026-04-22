import { Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./GoalSheet.styles";

type GoalProjectionHintProps = {
  readonly estimatedMonths: number | null;
};

export function GoalProjectionHint({ estimatedMonths }: GoalProjectionHintProps) {
  const { t } = useTranslation();
  const secondary = useThemeColor("secondary");

  return (
    <Text style={[styles.projectionHint, { color: secondary }]}>
      {estimatedMonths != null
        ? t("goals.create.projectionHint", { months: String(estimatedMonths) })
        : t("goals.create.noProjectionHint")}
    </Text>
  );
}
