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
import type { AddContributionInput, CreateGoalInput, Goal } from "../schema";
import { addContributionSchema, createGoalSchema } from "../schema";

type CommitGoalMutation = (command: MutationCommand) => Promise<boolean>;

export type GoalUpdateInput = Partial<
  Pick<
    Goal,
    "name" | "targetAmount" | "targetDate" | "interestRatePercent" | "iconName" | "colorHex"
  >
>;

type GoalMilestone = {
  readonly goalId: string;
  readonly goalName: string;
  readonly milestone: number;
};

type GoalMilestoneEffect = {
  readonly goalId: string;
  readonly goalName: string;
  readonly milestones: readonly number[];
};

type CreateGoalMutationServiceDeps = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly commit?: CommitGoalMutation;
  readonly now?: () => Date;
  readonly createGoalId?: () => string;
  readonly createContributionId?: () => string;
  readonly insertNotification?: typeof insertNotificationRecord;
  readonly schedulePush?: typeof scheduleLocalPush;
  readonly translateMilestoneTitle?: (input: GoalMilestone) => string;
  readonly translateMilestoneBody?: (input: GoalMilestone) => string;
  readonly trackCreated?: () => void;
  readonly trackContributionAdded?: () => void;
  readonly trackMilestoneReached?: () => void;
};

function publishGoalMilestone(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly milestone: GoalMilestone;
  readonly insertNotification: typeof insertNotificationRecord;
  readonly schedulePush: typeof scheduleLocalPush;
  readonly translateMilestoneTitle: (input: GoalMilestone) => string;
  readonly translateMilestoneBody: (input: GoalMilestone) => string;
  readonly trackMilestoneReached: () => void;
}): void {
  void input.insertNotification(input.db, input.userId, {
    type: "goal_milestone",
    dedupKey: `goal_milestone:${input.milestone.goalId}:${input.milestone.milestone}`,
    categoryId: null,
    goalId: input.milestone.goalId,
    titleKey: "notifications.goalMilestone",
    messageKey: "notifications.goalMilestoneMsg",
    params: JSON.stringify({
      goalName: input.milestone.goalName,
      percent: input.milestone.milestone,
    }),
  });
  input.trackMilestoneReached();
  void input.schedulePush({
    title: input.translateMilestoneTitle(input.milestone),
    body: input.translateMilestoneBody(input.milestone),
    data: { route: `/goal-detail?goalId=${input.milestone.goalId}` },
    preferenceKey: "goalMilestones",
  });
}

export function createGoalMutationService({
  db,
  userId,
  commit,
  now = () => new Date(),
  createGoalId = () => generateId("gl"),
  createContributionId = () => generateId("gc"),
  insertNotification = insertNotificationRecord,
  schedulePush = scheduleLocalPush,
  translateMilestoneTitle = ({ goalName, milestone }) =>
    i18n.t("notifications.goalMilestone", { goalName, percent: milestone }),
  translateMilestoneBody = ({ milestone }) =>
    i18n.t("notifications.goalMilestoneMsg", { percent: milestone }),
  trackCreated = trackGoalCreated,
  trackContributionAdded = trackGoalContributionAdded,
  trackMilestoneReached = trackGoalMilestoneReached,
}: CreateGoalMutationServiceDeps) {
  const mutations = createWriteThroughMutationModule(db);
  const commitGoalMutation =
    commit ??
    (async (command: MutationCommand): Promise<boolean> => {
      try {
        const result = await mutations.commit(command);
        return result.success;
      } catch {
        return false;
      }
    });

  return {
    createGoal: async (input: CreateGoalInput): Promise<boolean> => {
      const validation = createGoalSchema.safeParse(input);
      if (!validation.success) return false;

      const timestamp = toIsoDateTime(now());
      const didCommit = await commitGoalMutation({
        kind: "goal.save",
        row: {
          id: createGoalId(),
          userId,
          name: validation.data.name,
          type: validation.data.type,
          targetAmount: validation.data.targetAmount,
          targetDate: validation.data.targetDate ?? null,
          interestRatePercent: validation.data.interestRatePercent ?? null,
          iconName: validation.data.iconName ?? null,
          colorHex: validation.data.colorHex ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        },
      });
      if (!didCommit) return false;

      trackCreated();
      return true;
    },

    updateGoal: (goalId: string, data: GoalUpdateInput): Promise<boolean> =>
      commitGoalMutation({
        kind: "goal.update",
        goalId,
        data,
        now: toIsoDateTime(now()),
      }),

    deleteGoal: (goalId: string): Promise<boolean> =>
      commitGoalMutation({
        kind: "goal.delete",
        goalId,
        now: toIsoDateTime(now()),
      }),

    addContribution: async (input: AddContributionInput): Promise<boolean> => {
      const validation = addContributionSchema.safeParse(input);
      if (!validation.success) return false;

      const timestamp = toIsoDateTime(now());
      const didCommit = await commitGoalMutation({
        kind: "goalContribution.save",
        row: {
          id: createContributionId(),
          goalId: validation.data.goalId,
          userId,
          amount: validation.data.amount,
          note: validation.data.note ?? null,
          date: validation.data.date,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        },
      });
      if (!didCommit) return false;

      trackContributionAdded();
      return true;
    },

    deleteContribution: (id: string): Promise<boolean> =>
      commitGoalMutation({
        kind: "goalContribution.delete",
        contributionId: id,
        now: toIsoDateTime(now()),
      }),

    notifyMilestones: ({ goalId, goalName, milestones }: GoalMilestoneEffect): void => {
      milestones.forEach((milestone) => {
        publishGoalMilestone({
          db,
          userId,
          milestone: { goalId, goalName, milestone },
          insertNotification,
          schedulePush,
          translateMilestoneTitle,
          translateMilestoneBody,
          trackMilestoneReached,
        });
      });
    },
  };
}
