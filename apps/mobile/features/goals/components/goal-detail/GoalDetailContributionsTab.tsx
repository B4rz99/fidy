import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { ContributionRow } from "./ContributionRow";
import type { ContributionWithRunning } from "./GoalDetail.helpers";
import { styles } from "./GoalDetail.styles";

export function GoalDetailContributionsTab(props: {
  readonly contributions: readonly ContributionWithRunning[];
  readonly onAddPayment: () => void;
}) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: primaryColor }]}>
        {t("goals.detail.contributions")}
      </Text>
      {props.contributions.length > 0 ? (
        props.contributions.map((row) => <ContributionRow key={row.contribution.id} row={row} />)
      ) : (
        <Text style={[styles.emptyText, { color: secondaryColor }]}>
          {t("goals.detail.noContributions")}
        </Text>
      )}
      <Pressable
        style={[styles.ctaButton, { backgroundColor: accentGreen }]}
        onPress={props.onAddPayment}
      >
        <Text style={styles.ctaButtonText}>{t("goals.detail.addPayment")}</Text>
      </Pressable>
    </View>
  );
}
