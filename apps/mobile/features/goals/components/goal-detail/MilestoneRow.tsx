import { format } from "date-fns";
import { memo } from "react";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { Milestone } from "../../lib/derive";
import { styles } from "./GoalDetail.styles";

function MilestoneRowInner({ milestone }: { readonly milestone: Milestone }) {
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={styles.milestoneRow}>
      <View
        style={[
          styles.milestoneDot,
          { backgroundColor: milestone.isCompleted ? accentGreen : "#CCCCCC" },
        ]}
      />
      <View style={styles.milestoneContent}>
        <Text style={[styles.milestoneMonth, { color: primaryColor }]}>
          {format(milestone.month, "MMMM")}
        </Text>
        <Text style={[styles.milestoneAmount, { color: secondaryColor }]}>
          {formatMoney(milestone.cumulativeTarget)}
        </Text>
      </View>
    </View>
  );
}

export const MilestoneRow = memo(MilestoneRowInner);
