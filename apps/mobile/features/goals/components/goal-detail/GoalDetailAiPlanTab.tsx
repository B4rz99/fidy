import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { GoalProjection, Milestone } from "../../lib/derive";
import { styles } from "./GoalDetail.styles";
import { MilestoneRow } from "./MilestoneRow";

function GoalRecommendationCard(props: { readonly recommendationText: string }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={[styles.recommendationCard, { backgroundColor: cardBg }]}>
      <View style={[styles.recommendationIcon, { backgroundColor: accentGreenLight }]}>
        <Text style={{ color: accentGreen, fontSize: 18 }}>{"*"}</Text>
      </View>
      <View style={styles.recommendationContent}>
        <Text style={[styles.recommendationTitle, { color: primaryColor }]}>
          {t("goals.detail.recommendation")}
        </Text>
        <Text style={[styles.recommendationBody, { color: secondaryColor }]}>
          {props.recommendationText}
        </Text>
      </View>
    </View>
  );
}

export function GoalDetailAiPlanTab(props: {
  readonly milestones: readonly Milestone[];
  readonly onAskFidy: () => void;
  readonly projection: GoalProjection;
  readonly recommendationText: string;
}) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");

  return (
    <View style={styles.tabContent}>
      {props.projection.netMonthlySavings > 0 ? (
        <GoalRecommendationCard recommendationText={props.recommendationText} />
      ) : null}
      {props.milestones.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            {t("goals.milestones.title")}
          </Text>
          {props.milestones.map((milestone) => (
            <MilestoneRow key={milestone.month.toISOString()} milestone={milestone} />
          ))}
        </>
      ) : null}
      <Pressable
        style={[styles.ctaButton, { backgroundColor: accentGreen }]}
        onPress={props.onAskFidy}
      >
        <Text style={styles.ctaButtonText}>{t("goals.detail.askFidy")}</Text>
      </Pressable>
    </View>
  );
}
