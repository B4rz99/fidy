import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppAuroraBackground } from "@/shared/components";
import { ScrollView, View } from "@/shared/components/rn";
import { useColorScheme } from "@/shared/hooks";
import type { GoalProjection, Milestone } from "../../lib/derive";
import type { CelebrationMilestone } from "../CelebrationModal";
import { CelebrationModal } from "../CelebrationModal";
import type { ContributionWithRunning, TabType } from "./GoalDetail.helpers";
import { styles } from "./GoalDetail.styles";
import { GoalDetailHero } from "./GoalDetailHero";
import { GoalDetailTabPanel } from "./GoalDetailTabPanel";
import { ProjectionCard } from "./ProjectionCard";
import { TabControl } from "./TabControl";

export function GoalDetailContent(props: {
  readonly activeTab: TabType;
  readonly celebrationMilestone: CelebrationMilestone | null;
  readonly contributions: readonly ContributionWithRunning[];
  readonly currentAmount: number;
  readonly goalName: string;
  readonly onAddPayment: () => void;
  readonly onAskFidy: () => void;
  readonly onDismissCelebration: () => void;
  readonly onTabChange: (tab: TabType) => void;
  readonly percentComplete: number;
  readonly projection: GoalProjection;
  readonly recommendationText: string;
  readonly milestones: readonly Milestone[];
  readonly targetAmount: number;
}) {
  const isDark = useColorScheme() === "dark";
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <AppAuroraBackground isDark={isDark} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <GoalDetailHero
          currentAmount={props.currentAmount}
          percentComplete={props.percentComplete}
          targetAmount={props.targetAmount}
        />
        <ProjectionCard projection={props.projection} />
        <TabControl activeTab={props.activeTab} onTabChange={props.onTabChange} />
        <GoalDetailTabPanel
          activeTab={props.activeTab}
          contributions={props.contributions}
          milestones={props.milestones}
          onAddPayment={props.onAddPayment}
          onAskFidy={props.onAskFidy}
          projection={props.projection}
          recommendationText={props.recommendationText}
        />
      </ScrollView>
      {props.celebrationMilestone !== null ? (
        <CelebrationModal
          visible
          milestone={props.celebrationMilestone}
          goalName={props.goalName}
          currentAmount={props.currentAmount}
          targetAmount={props.targetAmount}
          onDismiss={props.onDismissCelebration}
        />
      ) : null}
    </View>
  );
}
