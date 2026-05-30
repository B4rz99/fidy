import { Button, EmptyState } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { ContributionRow } from "./ContributionRow";
import type { ContributionWithRunning } from "./GoalDetail.helpers";
import { styles } from "./GoalDetail.styles";

export function GoalDetailContributionsTab(props: {
  readonly contributions: readonly ContributionWithRunning[];
  readonly onAddPayment: () => void;
}) {
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");

  return (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: primaryColor }]}>
        {t("goals.detail.contributions")}
      </Text>
      {props.contributions.length > 0 ? (
        props.contributions.map((row) => <ContributionRow key={row.contribution.id} row={row} />)
      ) : (
        <EmptyState
          title={t("goals.detail.noContributions")}
          className="min-h-24 flex-none px-4 py-6"
        />
      )}
      <Button label={t("goals.detail.addPayment")} onPress={props.onAddPayment} />
    </View>
  );
}
