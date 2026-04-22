import { memo } from "react";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatDateDisplay, formatMoney } from "@/shared/lib";
import { requireIsoDate } from "@/shared/types/assertions";
import type { ContributionWithRunning } from "./GoalDetail.helpers";
import { styles } from "./GoalDetail.styles";

function ContributionRowInner(props: { readonly row: ContributionWithRunning }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={styles.contributionRow}>
      <View style={styles.contributionInfo}>
        <Text style={[styles.contributionDate, { color: primaryColor }]}>
          {formatDateDisplay(requireIsoDate(props.row.contribution.date))}
        </Text>
        <Text style={[styles.contributionNote, { color: secondaryColor }]}>
          {props.row.contribution.note ?? t("goals.detail.manualPayment")}
        </Text>
      </View>
      <Text style={[styles.contributionAmount, { color: accentGreen }]}>
        +{formatMoney(props.row.contribution.amount)}
      </Text>
      <Text style={[styles.contributionRunning, { color: secondaryColor }]}>
        {formatMoney(props.row.runningTotal)}
      </Text>
    </View>
  );
}

export const ContributionRow = memo(ContributionRowInner);
