import { create } from "zustand";
import { insertNotificationRecord, scheduleLocalPush } from "@/features/notifications";
import { createWriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db";
import { i18n } from "@/shared/i18n";
import {
  generateId,
  toIsoDateTime,
  trackGoalContributionAdded,
  trackGoalCreated,
  trackGoalMilestoneReached,
} from "@/shared/lib";
import type { MutationCommand } from "@/shared/mutations/write-through";
import type { UserId } from "@/shared/types/branded";
import type { GoalContribution } from "./schema";
import { addContributionSchema, createGoalSchema } from "./schema";
import { createGoalQueryService } from "./services/create-goal-query-service";
import type { GoalWithProgress } from "./types";

let goalsSessionId = 0;
let loadGoalsRequestId = 0;
let loadGoalContributionsRequestId = 0;

const goalQueryService = createGoalQueryService();
const GOAL_MILESTONES = [25, 50, 75, 100] as const;

type GoalState = {
  readonly activeUserId: UserId | null;
  readonly goals: readonly GoalWithProgress[];
  readonly selectedGoalId: string | null;
  readonly selectedGoalContributions: readonly GoalContribution[];
  readonly isLoading: boolean;
};

type GoalActions = {
  beginSession: (userId: UserId) => void;
  setGoals: (goals: readonly GoalWithProgress[]) => void;
  setSelectedGoalId: (goalId: string | null) => void;
  setSelectedGoalContributions: (contributions: readonly GoalContribution[]) => void;
  clearSelectedGoal: () => void;
  setIsLoading: (isLoading: boolean) => void;
};

export const useGoalStore = create<GoalState & GoalActions>((set) => ({
  activeUserId: null,
  goals: [],
  selectedGoalId: null,
  selectedGoalContributions: [],
  isLoading: false,

  beginSession: (userId) =>
    set({
      activeUserId: userId,
      goals: [],
      selectedGoalId: null,
      selectedGoalContributions: [],
      isLoading: false,
    }),
  setGoals: (goals) => set({ goals: [...goals], isLoading: false }),

  setSelectedGoalId: (selectedGoalId) => set({ selectedGoalId }),

  setSelectedGoalContributions: (selectedGoalContributions) =>
    set({ selectedGoalContributions: [...selectedGoalContributions] }),

  clearSelectedGoal: () => set({ selectedGoalId: null, selectedGoalContributions: [] }),
  setIsLoading: (isLoading) => set({ isLoading }),
}));

function isCurrentGoalsRequest(requestId: number, userId: UserId, sessionId: number): boolean {
  return (
    loadGoalsRequestId === requestId &&
    useGoalStore.getState().activeUserId === userId &&
    goalsSessionId === sessionId
  );
}

function isCurrentGoalSelection(
  requestId: number,
  userId: UserId,
  goalId: string,
  sessionId: number
): boolean {
  return (
    loadGoalContributionsRequestId === requestId &&
    useGoalStore.getState().activeUserId === userId &&
    useGoalStore.getState().selectedGoalId === goalId &&
    goalsSessionId === sessionId
  );
}

function isActiveGoalSession(userId: UserId, sessionId: number): boolean {
  return goalsSessionId === sessionId && useGoalStore.getState().activeUserId === userId;
}

function getCrossedMilestones(percentBefore: number, percentAfter: number) {
  return GOAL_MILESTONES.filter(
    (milestone) => percentBefore < milestone && percentAfter >= milestone
  );
}

async function commitGoalMutation(db: AnyDb, command: MutationCommand): Promise<boolean> {
  const mutations = createWriteThroughMutationModule(db);

  try {
    const result = await mutations.commit(command);
    return result.success;
  } catch {
    return false;
  }
}

async function refreshGoalsForActiveSession(
  db: AnyDb,
  userId: UserId,
  sessionId: number
): Promise<boolean> {
  if (!isActiveGoalSession(userId, sessionId)) return false;
  await loadGoalsForUser(db, userId);
  return isActiveGoalSession(userId, sessionId);
}

async function refreshSelectedGoalContributions(
  db: AnyDb,
  userId: UserId,
  goalId: string,
  sessionId: number
): Promise<boolean> {
  if (!isActiveGoalSession(userId, sessionId)) return false;
  await selectGoal(db, userId, goalId);
  return isActiveGoalSession(userId, sessionId);
}

function buildGoalMilestoneNotification(goalName: string, goalId: string, milestone: number) {
  return {
    type: "goal_milestone" as const,
    dedupKey: `goal_milestone:${goalId}:${milestone}`,
    categoryId: null,
    goalId,
    titleKey: "notifications.goalMilestone",
    messageKey: "notifications.goalMilestoneMsg",
    params: JSON.stringify({
      goalName,
      percent: milestone,
    }),
  };
}

export function initializeGoalSession(userId: UserId): void {
  goalsSessionId += 1;
  loadGoalsRequestId += 1;
  loadGoalContributionsRequestId += 1;
  useGoalStore.getState().beginSession(userId);
}

export async function loadGoalsForUser(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadGoalsRequestId;
  const sessionId = goalsSessionId;
  useGoalStore.getState().setIsLoading(true);

  try {
    const goals = await goalQueryService.loadGoals({ db, userId });
    if (!isCurrentGoalsRequest(requestId, userId, sessionId)) {
      if (loadGoalsRequestId === requestId) {
        useGoalStore.getState().setIsLoading(false);
      }
      return;
    }
    useGoalStore.getState().setGoals(goals);
  } catch {
    if (loadGoalsRequestId === requestId) {
      useGoalStore.getState().setIsLoading(false);
    }
  }
}

export async function selectGoal(db: AnyDb, userId: UserId, goalId: string | null): Promise<void> {
  const requestId = ++loadGoalContributionsRequestId;
  const sessionId = goalsSessionId;
  useGoalStore.getState().setSelectedGoalId(goalId);

  if (goalId == null) {
    useGoalStore.getState().setSelectedGoalContributions([]);
    return;
  }

  try {
    const contributions = await goalQueryService.loadGoalContributions({ db, goalId });
    if (!isCurrentGoalSelection(requestId, userId, goalId, sessionId)) {
      return;
    }
    useGoalStore.getState().setSelectedGoalContributions(contributions);
  } catch {
    // Keep existing selection state on read failures.
  }
}

export async function createGoal(
  db: AnyDb,
  userId: UserId,
  input: {
    readonly name: string;
    readonly type: "savings" | "debt";
    readonly targetAmount: number;
    readonly targetDate?: string;
    readonly interestRatePercent?: number;
    readonly iconName?: string;
    readonly colorHex?: string;
  }
): Promise<boolean> {
  const validation = createGoalSchema.safeParse(input);
  if (!validation.success) return false;

  const sessionId = goalsSessionId;
  const now = toIsoDateTime(new Date());
  const didCommit = await commitGoalMutation(db, {
    kind: "goal.save",
    row: {
      id: generateId("gl"),
      userId,
      name: input.name,
      type: input.type,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate ?? null,
      interestRatePercent: input.interestRatePercent ?? null,
      iconName: input.iconName ?? null,
      colorHex: input.colorHex ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  });
  if (!didCommit) return false;
  trackGoalCreated();

  return refreshGoalsForActiveSession(db, userId, sessionId);
}

export async function updateGoal(
  db: AnyDb,
  userId: UserId,
  id: string,
  data: {
    readonly name?: string;
    readonly targetAmount?: number;
    readonly targetDate?: string | null;
    readonly interestRatePercent?: number | null;
    readonly iconName?: string | null;
    readonly colorHex?: string | null;
  }
): Promise<boolean> {
  const sessionId = goalsSessionId;
  const didCommit = await commitGoalMutation(db, {
    kind: "goal.update",
    goalId: id,
    data,
    now: toIsoDateTime(new Date()),
  });
  if (!didCommit) return false;

  return refreshGoalsForActiveSession(db, userId, sessionId);
}

export async function deleteGoal(db: AnyDb, userId: UserId, id: string): Promise<boolean> {
  const sessionId = goalsSessionId;
  const didCommit = await commitGoalMutation(db, {
    kind: "goal.delete",
    goalId: id,
    now: toIsoDateTime(new Date()),
  });
  if (!didCommit) return false;
  if (!isActiveGoalSession(userId, sessionId)) return false;

  if (useGoalStore.getState().selectedGoalId === id) {
    useGoalStore.getState().clearSelectedGoal();
  }

  return refreshGoalsForActiveSession(db, userId, sessionId);
}

export async function addContribution(
  db: AnyDb,
  userId: UserId,
  input: {
    readonly goalId: string;
    readonly amount: number;
    readonly note?: string;
    readonly date: string;
  }
): Promise<boolean> {
  const validation = addContributionSchema.safeParse(input);
  if (!validation.success) return false;

  const sessionId = goalsSessionId;
  const now = toIsoDateTime(new Date());
  const percentBefore =
    useGoalStore.getState().goals.find((goal) => goal.goal.id === input.goalId)?.progress
      .percentComplete ?? 0;
  const didCommit = await commitGoalMutation(db, {
    kind: "goalContribution.save",
    row: {
      id: generateId("gc"),
      goalId: input.goalId,
      userId,
      amount: input.amount,
      note: input.note ?? null,
      date: input.date,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  });
  if (!didCommit) return false;
  trackGoalContributionAdded();

  const didRefreshGoals = await refreshGoalsForActiveSession(db, userId, sessionId);
  if (!didRefreshGoals) return false;

  const selectedGoal = useGoalStore.getState().goals.find((goal) => goal.goal.id === input.goalId);
  if (selectedGoal == null) return true;

  getCrossedMilestones(percentBefore, selectedGoal.progress.percentComplete).forEach(
    (milestone) => {
      void insertNotificationRecord(
        db,
        userId,
        buildGoalMilestoneNotification(selectedGoal.goal.name, input.goalId, milestone)
      );
      trackGoalMilestoneReached();
      void scheduleLocalPush({
        title: i18n.t("notifications.goalMilestone", {
          goalName: selectedGoal.goal.name,
          percent: milestone,
        }),
        body: i18n.t("notifications.goalMilestoneMsg", { percent: milestone }),
        data: { route: `/goal-detail?id=${input.goalId}` },
        preferenceKey: "goalMilestones",
      });
    }
  );

  if (useGoalStore.getState().selectedGoalId !== input.goalId) {
    return true;
  }

  return refreshSelectedGoalContributions(db, userId, input.goalId, sessionId);
}

export async function deleteContribution(db: AnyDb, userId: UserId, id: string): Promise<boolean> {
  const sessionId = goalsSessionId;
  const didCommit = await commitGoalMutation(db, {
    kind: "goalContribution.delete",
    contributionId: id,
    now: toIsoDateTime(new Date()),
  });
  if (!didCommit) return false;

  const didRefreshGoals = await refreshGoalsForActiveSession(db, userId, sessionId);
  if (!didRefreshGoals) return false;

  const selectedGoalId = useGoalStore.getState().selectedGoalId;
  if (selectedGoalId == null) {
    return true;
  }

  return refreshSelectedGoalContributions(db, userId, selectedGoalId, sessionId);
}
