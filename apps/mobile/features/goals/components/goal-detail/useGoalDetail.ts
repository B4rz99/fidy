import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { tryGetDb } from "@/shared/db";
import { useSubscription, useTranslation } from "@/shared/hooks";
import { resolveGoalDetailGoalId } from "../../lib/route-params";
import type { GoalContribution } from "../../schema";
import { selectGoal, useGoalStore } from "../../store";
import type { GoalWithProgress } from "../../types";
import type { CelebrationMilestone } from "../CelebrationModal";
import {
  buildContributionRows,
  buildGoalMilestones,
  buildGoalRecommendationCopy,
  type GoalMilestoneBaseline,
  getNextGoalMilestoneState,
  type TabType,
} from "./GoalDetail.helpers";

function getVisibleContributions(
  activeGoalId: string | null,
  selectedGoalId: string | null,
  contributions: readonly GoalContribution[]
) {
  return activeGoalId === selectedGoalId ? contributions : [];
}

function useGoalDetailSelection() {
  const routeParams = useLocalSearchParams<{
    goalId?: string | string[];
    id?: string | string[];
  }>();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const routeGoalId = resolveGoalDetailGoalId(routeParams);
  const selectedGoalId = useGoalStore((state) => state.selectedGoalId);
  const goals = useGoalStore((state) => state.goals);
  const contributions = useGoalStore((state) => state.selectedGoalContributions);
  const activeGoalId = routeGoalId ?? selectedGoalId;

  useSubscription(
    () => {
      if (!db || !userId || routeGoalId == null) {
        return;
      }

      void selectGoal(db, userId, routeGoalId);
    },
    [db, routeGoalId, selectedGoalId, userId],
    db != null && userId != null && routeGoalId != null && routeGoalId !== selectedGoalId
  );

  return {
    goalData: goals.find((goal) => goal.goal.id === activeGoalId) ?? null,
    visibleContributions: getVisibleContributions(activeGoalId, selectedGoalId, contributions),
  };
}

function useGoalDetailTabs() {
  const [activeTab, setActiveTab] = useState<TabType>("contributions");
  const onTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  return { activeTab, onTabChange };
}

function useGoalDetailNavigation() {
  const { push } = useRouter();

  return {
    onAddPayment: useCallback(() => {
      push("/add-payment" as never);
    }, [push]),
    onAskFidy: useCallback(() => {
      push("/(tabs)/(ai)" as never);
    }, [push]),
    onEditGoal: useCallback(() => {
      push("/edit-goal" as never);
    }, [push]),
  };
}

function useGoalDetailCelebration(goalData: GoalWithProgress | null) {
  const [celebrationMilestone, setCelebrationMilestone] = useState<CelebrationMilestone | null>(
    null
  );
  const milestoneBaselineRef = useRef<GoalMilestoneBaseline>({ goalId: null, percent: null });

  useSubscription(() => {
    const nextState = getNextGoalMilestoneState(milestoneBaselineRef.current, goalData);

    if (nextState.crossedMilestone != null) {
      setCelebrationMilestone(nextState.crossedMilestone);
    }

    milestoneBaselineRef.current = nextState.baseline;
  }, [goalData]);

  return {
    celebrationMilestone,
    onDismissCelebration: useCallback(() => {
      setCelebrationMilestone(null);
    }, []),
  };
}

function useGoalDetailDerivedData(
  goalData: GoalWithProgress | null,
  visibleContributions: readonly GoalContribution[]
) {
  const { t } = useTranslation();

  if (goalData == null) {
    return { contributions: [], milestones: [], recommendationText: "" };
  }

  const recommendation = buildGoalRecommendationCopy(goalData.projection);

  return {
    contributions: buildContributionRows(visibleContributions),
    milestones: buildGoalMilestones(goalData.currentAmount, goalData.projection),
    recommendationText: t(recommendation.key, recommendation.values),
  };
}

export function useGoalDetail() {
  const selection = useGoalDetailSelection();
  const tabs = useGoalDetailTabs();
  const navigation = useGoalDetailNavigation();
  const celebration = useGoalDetailCelebration(selection.goalData);
  const derived = useGoalDetailDerivedData(selection.goalData, selection.visibleContributions);

  return {
    ...selection,
    ...tabs,
    ...navigation,
    ...celebration,
    ...derived,
  };
}
