import type { GoalProjection, Milestone } from "../../lib/derive";
import type { ContributionWithRunning, TabType } from "./GoalDetail.helpers";
import { GoalDetailAiPlanTab } from "./GoalDetailAiPlanTab";
import { GoalDetailContributionsTab } from "./GoalDetailContributionsTab";

export function GoalDetailTabPanel(props: {
  readonly activeTab: TabType;
  readonly contributions: readonly ContributionWithRunning[];
  readonly milestones: readonly Milestone[];
  readonly onAddPayment: () => void;
  readonly onAskFidy: () => void;
  readonly projection: GoalProjection;
  readonly recommendationText: string;
}) {
  return props.activeTab === "contributions" ? (
    <GoalDetailContributionsTab
      contributions={props.contributions}
      onAddPayment={props.onAddPayment}
    />
  ) : (
    <GoalDetailAiPlanTab
      milestones={props.milestones}
      onAskFidy={props.onAskFidy}
      projection={props.projection}
      recommendationText={props.recommendationText}
    />
  );
}
