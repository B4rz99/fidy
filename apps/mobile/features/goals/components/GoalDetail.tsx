import { format } from "date-fns";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatDateDisplay, formatMoney } from "@/shared/lib";
import type { CopAmount, IsoDate } from "@/shared/types/branded";
import type { GoalProjection, Milestone } from "../lib/derive";
import { deriveMonthlyMilestones } from "../lib/derive";
import type { GoalContribution } from "../schema";
import { useGoalStore } from "../store";
import type { CelebrationMilestone } from "./CelebrationModal";
import { CelebrationModal } from "./CelebrationModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabType = "contributions" | "aiPlan";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const MILESTONE_THRESHOLDS: readonly CelebrationMilestone[] = [25, 50, 75, 100];

/**
 * Returns the highest milestone crossed when going from prevPercent to currentPercent,
 * or null if no milestone was crossed.
 */
const checkMilestoneCrossed = (
  prevPercent: number,
  currentPercent: number
): CelebrationMilestone | null => {
  const crossed = MILESTONE_THRESHOLDS.filter(
    (threshold) => prevPercent < threshold && currentPercent >= threshold
  );
  return crossed.length > 0 ? crossed[crossed.length - 1] : null;
};

// ---------------------------------------------------------------------------
// Progress Ring
// ---------------------------------------------------------------------------

function ProgressRing({ percent }: { readonly percent: number }) {
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const primaryColor = useThemeColor("primary");

  const size = 96;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const strokeDashoffset = circumference * (1 - clampedPercent / 100);

  return (
    <View style={styles.ringContainer}>
      <Svg width={size} height={size}>
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accentGreenLight}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accentGreen}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={[styles.ringText, { color: primaryColor }]}>{percent}%</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Projection Card
// ---------------------------------------------------------------------------

function ProjectionCard({ projection }: { readonly projection: GoalProjection }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  if (projection.confidence === "none") {
    return (
      <View style={[styles.projectionCard, { backgroundColor: accentGreenLight }]}>
        <Text style={[styles.projectionText, { color: accentGreen }]}>
          {t("goals.detail.setTargetDate")}
        </Text>
      </View>
    );
  }

  if (projection.netMonthlySavings <= 0) {
    return (
      <View style={[styles.projectionCard, { backgroundColor: accentGreenLight }]}>
        <Text style={[styles.projectionText, { color: accentGreen }]}>
          {t("goals.detail.spendingExceedsIncome")}
        </Text>
      </View>
    );
  }

  const isDashed = projection.confidence === "low";
  const dateText =
    projection.projectedDate != null ? format(projection.projectedDate, "MMMM yyyy") : "";

  return (
    <View
      style={[
        styles.projectionCard,
        { backgroundColor: accentGreenLight },
        isDashed
          ? { borderWidth: 1.5, borderColor: accentGreen, borderStyle: "dashed" }
          : undefined,
      ]}
    >
      <Text style={[styles.projectionText, { color: accentGreen }]}>
        {projection.confidence === "low"
          ? t("goals.detail.roughEstimate", {
              months: String(projection.monthsToGo),
            })
          : t("goals.detail.estimated", { date: dateText })}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab Control
// ---------------------------------------------------------------------------

function TabControl({
  activeTab,
  onTabChange,
}: {
  readonly activeTab: TabType;
  readonly onTabChange: (tab: TabType) => void;
}) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const cardBg = useThemeColor("card");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={[styles.tabContainer, { backgroundColor: cardBg }]}>
      <Pressable
        style={[
          styles.tabButton,
          activeTab === "contributions" ? { backgroundColor: accentGreen } : undefined,
        ]}
        onPress={() => onTabChange("contributions")}
      >
        <Text
          style={[
            styles.tabText,
            { color: activeTab === "contributions" ? "#FFFFFF" : secondaryColor },
          ]}
        >
          {t("goals.detail.contributions")}
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.tabButton,
          activeTab === "aiPlan" ? { backgroundColor: accentGreen } : undefined,
        ]}
        onPress={() => onTabChange("aiPlan")}
      >
        <Text
          style={[styles.tabText, { color: activeTab === "aiPlan" ? "#FFFFFF" : secondaryColor }]}
        >
          {t("goals.detail.aiPlan")}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Contribution Row (memoized)
// ---------------------------------------------------------------------------

function ContributionRowInner({
  contribution,
  runningTotal,
}: {
  readonly contribution: GoalContribution;
  readonly runningTotal: number;
}) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={styles.contributionRow}>
      <View style={styles.contributionInfo}>
        <Text style={[styles.contributionDate, { color: primaryColor }]}>
          {formatDateDisplay(contribution.date as IsoDate)}
        </Text>
        <Text style={[styles.contributionNote, { color: secondaryColor }]}>
          {contribution.note != null ? contribution.note : t("goals.detail.manualPayment")}
        </Text>
      </View>
      <Text style={[styles.contributionAmount, { color: accentGreen }]}>
        +{formatMoney(contribution.amount as CopAmount)}
      </Text>
      <Text style={[styles.contributionRunning, { color: secondaryColor }]}>
        {formatMoney(runningTotal as CopAmount)}
      </Text>
    </View>
  );
}

const ContributionRow = memo(ContributionRowInner);

// ---------------------------------------------------------------------------
// Milestone Row (memoized)
// ---------------------------------------------------------------------------

function MilestoneRowInner({ milestone }: { readonly milestone: Milestone }) {
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={styles.milestoneRow}>
      <View
        style={[
          styles.milestoneDot,
          {
            backgroundColor: milestone.isCompleted ? accentGreen : "#CCCCCC",
          },
        ]}
      />
      <View style={styles.milestoneContent}>
        <Text style={[styles.milestoneMonth, { color: primaryColor }]}>
          {format(milestone.month, "MMMM")}
        </Text>
        <Text style={[styles.milestoneAmount, { color: secondaryColor }]}>
          {formatMoney(milestone.cumulativeTarget as CopAmount)}
        </Text>
      </View>
    </View>
  );
}

const MilestoneRow = memo(MilestoneRowInner);

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function GoalDetailScreen() {
  const { t } = useTranslation();
  const { push } = useRouter();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const cardBg = useThemeColor("card");
  const pageBg = useThemeColor("page");

  const [activeTab, setActiveTab] = useState<TabType>("contributions");
  const [celebrationMilestone, setCelebrationMilestone] = useState<CelebrationMilestone | null>(
    null
  );

  const selectedGoalId = useGoalStore((s) => s.selectedGoalId);
  const goals = useGoalStore((s) => s.goals);
  const contributions = useGoalStore((s) => s.selectedGoalContributions);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleDismissCelebration = useCallback(() => {
    setCelebrationMilestone(null);
  }, []);

  const handleAddPayment = useCallback(() => {
    push("/add-payment" as never);
  }, [push]);

  const handleEditGoal = useCallback(() => {
    push("/edit-goal" as never);
  }, [push]);

  const handleAskFidy = useCallback(() => {
    push("/(tabs)/(ai)" as never);
  }, [push]);

  // Find the selected goal
  const goalData = goals.find((g) => g.goal.id === selectedGoalId);

  // Track previous progress percent to detect milestone crossings.
  // Allowed useEffect: subscription/listener pattern detecting external store changes.
  const prevPercentRef = useRef<number | null>(null);
  useEffect(() => {
    if (goalData == null) return;
    const currentPercent = goalData.progress.percentComplete;
    const prevPercent = prevPercentRef.current;
    if (prevPercent !== null && prevPercent !== currentPercent) {
      const crossed = checkMilestoneCrossed(prevPercent, currentPercent);
      if (crossed !== null) {
        setCelebrationMilestone(crossed);
      }
    }
    prevPercentRef.current = currentPercent;
  }, [goalData]);

  if (goalData == null) {
    return null;
  }

  const { goal, currentAmount, progress, projection } = goalData;

  // Compute running totals for contribution history
  const contributionsWithRunning: Array<{ contribution: GoalContribution; runningTotal: number }> =
    (() => {
      const reversed = [...contributions].reverse();
      const result: Array<{ contribution: GoalContribution; runningTotal: number }> = [];
      reversed.forEach((c) => {
        const prevTotal = result.length > 0 ? result[result.length - 1].runningTotal : 0;
        result.push({ contribution: c, runningTotal: prevTotal + c.amount });
      });
      return result.reverse();
    })();

  // AI Plan milestones
  const milestones: readonly Milestone[] =
    projection.monthsToGo != null && projection.netMonthlySavings > 0
      ? deriveMonthlyMilestones(
          currentAmount,
          projection.netMonthlySavings,
          Math.min(projection.monthsToGo, 12)
        )
      : [];

  // Recommendation text
  const recommendationText =
    projection.projectedDate != null
      ? t("goals.detail.recommendationText", {
          amount: formatMoney(Math.round(projection.netMonthlySavings) as CopAmount),
          date: format(projection.projectedDate, "MMMM yyyy"),
        })
      : t("goals.detail.recommendationTextNoDate", {
          amount: formatMoney(Math.round(projection.netMonthlySavings) as CopAmount),
        });

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      {Platform.OS === "ios" ? (
        <Stack.Screen
          options={{
            headerTitle: goal.name,
            headerRight: () => (
              <Pressable onPress={handleEditGoal} hitSlop={8}>
                <Text style={[styles.editHeaderButton, { color: accentGreen }]}>
                  {t("common.edit")}
                </Text>
              </Pressable>
            ),
          }}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Hero section */}
        <View style={styles.heroSection}>
          <ProgressRing percent={Math.min(progress.percentComplete, 100)} />
          <View style={styles.amountRow}>
            <Text style={[styles.currentAmount, { color: primaryColor }]}>
              {formatMoney(currentAmount as CopAmount)}
            </Text>
            <Text style={[styles.amountDivider, { color: secondaryColor }]}>/</Text>
            <Text style={[styles.targetAmount, { color: secondaryColor }]}>
              {formatMoney(goal.targetAmount as CopAmount)}
            </Text>
          </View>
        </View>

        {/* Projection card */}
        <ProjectionCard projection={projection} />

        {/* Tab control */}
        <TabControl activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab content */}
        {activeTab === "contributions" ? (
          <View style={styles.tabContent}>
            {/* Section header */}
            <Text style={[styles.sectionTitle, { color: primaryColor }]}>
              {t("goals.detail.contributions")}
            </Text>

            {/* Contribution rows */}
            {contributionsWithRunning.length > 0 ? (
              contributionsWithRunning.map(({ contribution, runningTotal }) => (
                <ContributionRow
                  key={contribution.id}
                  contribution={contribution}
                  runningTotal={runningTotal}
                />
              ))
            ) : (
              <Text style={[styles.emptyText, { color: secondaryColor }]}>
                {t("goals.detail.noContributions")}
              </Text>
            )}

            {/* Add payment button */}
            <Pressable
              style={[styles.ctaButton, { backgroundColor: accentGreen }]}
              onPress={handleAddPayment}
            >
              <Text style={styles.ctaButtonText}>{t("goals.detail.addPayment")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.tabContent}>
            {/* Fidy recommendation card */}
            {projection.netMonthlySavings > 0 ? (
              <View style={[styles.recommendationCard, { backgroundColor: cardBg }]}>
                <View style={[styles.recommendationIcon, { backgroundColor: accentGreenLight }]}>
                  <Text style={{ color: accentGreen, fontSize: 18 }}>{"*"}</Text>
                </View>
                <View style={styles.recommendationContent}>
                  <Text style={[styles.recommendationTitle, { color: primaryColor }]}>
                    {t("goals.detail.recommendation")}
                  </Text>
                  <Text style={[styles.recommendationBody, { color: secondaryColor }]}>
                    {recommendationText}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Milestones */}
            {milestones.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { color: primaryColor }]}>
                  {t("goals.milestones.title")}
                </Text>
                {milestones.map((m) => (
                  <MilestoneRow key={m.month.toISOString()} milestone={m} />
                ))}
              </>
            ) : null}

            {/* Ask Fidy CTA */}
            <Pressable
              style={[styles.ctaButton, { backgroundColor: accentGreen }]}
              onPress={handleAskFidy}
            >
              <Text style={styles.ctaButtonText}>{t("goals.detail.askFidy")}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Milestone celebration overlay */}
      {celebrationMilestone !== null ? (
        <CelebrationModal
          visible
          milestone={celebrationMilestone}
          goalName={goal.name}
          currentAmount={currentAmount}
          targetAmount={goal.targetAmount}
          onDismiss={handleDismissCelebration}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },

  // Hero
  heroSection: {
    alignItems: "center",
    gap: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  currentAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  amountDivider: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  targetAmount: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },

  // Progress ring
  ringContainer: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: {
    position: "absolute",
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 20,
  },

  // Projection card
  projectionCard: {
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderCurve: "continuous",
  },
  projectionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    textAlign: "center",
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    borderCurve: "continuous",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 8,
    borderCurve: "continuous",
  },
  tabText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },

  // Tab content
  tabContent: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },

  // Contribution row
  contributionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  contributionInfo: {
    flex: 1,
    gap: 2,
  },
  contributionDate: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  contributionNote: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  contributionAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  contributionRunning: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    marginLeft: 8,
  },

  // Empty text
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 16,
  },

  // CTA button
  ctaButton: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    marginTop: 4,
  },
  ctaButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },

  // Recommendation card
  recommendationCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    padding: 16,
    borderCurve: "continuous",
  },
  recommendationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationContent: {
    flex: 1,
    gap: 4,
  },
  recommendationTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  recommendationBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 20,
  },

  // Milestone row
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  milestoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  milestoneContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  milestoneMonth: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  milestoneAmount: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  editHeaderButton: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
});
