import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { styles } from "./GoalDetail.styles";
import { ProgressRing } from "./ProgressRing";

export function GoalDetailHero(props: {
  readonly currentAmount: number;
  readonly percentComplete: number;
  readonly targetAmount: number;
}) {
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={styles.heroSection}>
      <ProgressRing percent={Math.min(props.percentComplete, 100)} />
      <View style={styles.amountRow}>
        <Text style={[styles.currentAmount, { color: primaryColor }]}>
          {formatMoney(props.currentAmount)}
        </Text>
        <Text style={[styles.amountDivider, { color: secondaryColor }]}>/</Text>
        <Text style={[styles.targetAmount, { color: secondaryColor }]}>
          {formatMoney(props.targetAmount)}
        </Text>
      </View>
    </View>
  );
}
