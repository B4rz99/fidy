import { create } from "zustand";
import type { AnyDb } from "@/shared/db/client";
import type { UserId } from "@/shared/types/branded";
import type { AddContributionInput, CreateGoalInput, GoalContribution } from "./schema";
import {
  createGoalMutationService,
  type GoalUpdateInput,
} from "./services/create-goal-mutation-service";
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

type GoalSessionSnapshot = {
  readonly userId: UserId;
  readonly sessionId: number;
};

type GoalRequestSnapshot = GoalSessionSnapshot & {
  readonly requestId: number;
};

type GoalSelectionSnapshot = GoalRequestSnapshot & {
  readonly goalId: string;
};

type GoalRefreshSnapshot = GoalSessionSnapshot & {
  readonly db: AnyDb;
};

type GoalSelectionRefreshSnapshot = GoalRefreshSnapshot & {
  readonly goalId: string;
};

type GoalUpdateRequest = {
  readonly id: string;
  readonly data: GoalUpdateInput;
};

type GoalMutationService = ReturnType<typeof createGoalMutationService>;

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

function isActiveGoalSession(session: GoalSessionSnapshot): boolean {
  const { activeUserId } = useGoalStore.getState();
  return [goalsSessionId === session.sessionId, activeUserId === session.userId].every(Boolean);
}

function isCurrentGoalsRequest(request: GoalRequestSnapshot): boolean {
  return [loadGoalsRequestId === request.requestId, isActiveGoalSession(request)].every(Boolean);
}

function isCurrentGoalSelection(request: GoalSelectionSnapshot): boolean {
  const { selectedGoalId } = useGoalStore.getState();
  return [
    loadGoalContributionsRequestId === request.requestId,
    selectedGoalId === request.goalId,
    isActiveGoalSession(request),
  ].every(Boolean);
}

function clearGoalsLoadingIfCurrent(requestId: number): void {
  if (loadGoalsRequestId === requestId) {
    useGoalStore.getState().setIsLoading(false);
  }
}

async function refreshGoalsForActiveSession(input: GoalRefreshSnapshot): Promise<boolean> {
  if (!isActiveGoalSession(input)) return false;
  await loadGoalsForUser(input.db, input.userId);
  return isActiveGoalSession(input);
}

async function refreshSelectedGoalContributions(
  input: GoalSelectionRefreshSnapshot
): Promise<boolean> {
  if (!isActiveGoalSession(input)) return false;
  await selectGoal(input.db, input.userId, input.goalId);
  return isActiveGoalSession(input);
}

function getGoalById(goalId: string): GoalWithProgress | null {
  return useGoalStore.getState().goals.find((goal) => goal.goal.id === goalId) ?? null;
}

function getGoalPercentComplete(goalId: string): number {
  const goal = getGoalById(goalId);
  return goal == null ? 0 : goal.progress.percentComplete;
}

export function initializeGoalSession(userId: UserId): void {
  goalsSessionId += 1;
  loadGoalsRequestId += 1;
  loadGoalContributionsRequestId += 1;
  useGoalStore.getState().beginSession(userId);
}

export async function loadGoalsForUser(db: AnyDb, userId: UserId): Promise<void> {
  const request: GoalRequestSnapshot = {
    userId,
    sessionId: goalsSessionId,
    requestId: ++loadGoalsRequestId,
  };
  useGoalStore.getState().setIsLoading(true);

  try {
    const goals = await goalQueryService.loadGoals({ db, userId });
    if (!isCurrentGoalsRequest(request)) {
      clearGoalsLoadingIfCurrent(request.requestId);
      return;
    }
    useGoalStore.getState().setGoals(goals);
  } catch {
    clearGoalsLoadingIfCurrent(request.requestId);
  }
}

export async function selectGoal(db: AnyDb, userId: UserId, goalId: string | null): Promise<void> {
  const requestId = ++loadGoalContributionsRequestId;
  const session: GoalSessionSnapshot = { userId, sessionId: goalsSessionId };
  useGoalStore.getState().setSelectedGoalId(goalId);

  if (goalId == null) {
    useGoalStore.getState().setSelectedGoalContributions([]);
    return;
  }

  try {
    const contributions = await goalQueryService.loadGoalContributions({ db, goalId });
    if (!isCurrentGoalSelection({ ...session, goalId, requestId })) {
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
  input: CreateGoalInput
): Promise<boolean> {
  const session: GoalSessionSnapshot = { userId, sessionId: goalsSessionId };
  const didCreate = await createGoalMutationService({ db, userId }).createGoal(input);
  if (!didCreate) return false;
  return refreshGoalsForActiveSession({ db, ...session });
}

export async function updateGoal(
  db: AnyDb,
  userId: UserId,
  input: GoalUpdateRequest
): Promise<boolean> {
  const session: GoalSessionSnapshot = { userId, sessionId: goalsSessionId };
  const didUpdate = await createGoalMutationService({ db, userId }).updateGoal(
    input.id,
    input.data
  );
  if (!didUpdate) return false;
  return refreshGoalsForActiveSession({ db, ...session });
}

export async function deleteGoal(db: AnyDb, userId: UserId, id: string): Promise<boolean> {
  const session: GoalSessionSnapshot = { userId, sessionId: goalsSessionId };
  const didDelete = await createGoalMutationService({ db, userId }).deleteGoal(id);
  if (!didDelete) return false;
  if (!isActiveGoalSession(session)) return false;

  if (useGoalStore.getState().selectedGoalId === id) {
    useGoalStore.getState().clearSelectedGoal();
  }
  return refreshGoalsForActiveSession({ db, ...session });
}

function getCrossedMilestones(percentBefore: number, percentAfter: number) {
  return GOAL_MILESTONES.filter(
    (milestone) => percentBefore < milestone && percentAfter >= milestone
  );
}

async function notifyGoalMilestones(
  goalMutations: GoalMutationService,
  goalId: string,
  percentBefore: number
) {
  const goal = getGoalById(goalId);
  if (goal == null) return;

  const milestones = getCrossedMilestones(percentBefore, goal.progress.percentComplete);
  if (milestones.length === 0) return;

  await goalMutations.notifyMilestones({
    goalId,
    goalName: goal.goal.name,
    milestones,
  });
}

export async function addContribution(
  db: AnyDb,
  userId: UserId,
  input: AddContributionInput
): Promise<boolean> {
  const session: GoalSessionSnapshot = { userId, sessionId: goalsSessionId };
  const goalMutations: GoalMutationService = createGoalMutationService({ db, userId });
  const percentBefore = getGoalPercentComplete(input.goalId);
  const didAdd = await goalMutations.addContribution(input);
  if (!didAdd) return false;

  const didRefreshGoals = await refreshGoalsForActiveSession({ db, ...session });
  if (!didRefreshGoals) return false;

  await notifyGoalMilestones(goalMutations, input.goalId, percentBefore);
  return useGoalStore.getState().selectedGoalId === input.goalId
    ? refreshSelectedGoalContributions({ db, ...session, goalId: input.goalId })
    : true;
}
