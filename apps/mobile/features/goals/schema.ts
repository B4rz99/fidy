import { z } from "zod";

const goalTypeSchema = z.enum(["savings", "debt"]);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((val) => !Number.isNaN(new Date(val).getTime()), "Invalid calendar date");

export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  type: goalTypeSchema,
  targetAmount: z.number().int().positive(),
  targetDate: isoDateSchema.optional(),
  interestRatePercent: z.number().min(0).max(100).optional(),
  iconName: z.string().optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const addContributionSchema = z.object({
  goalId: z.string().min(1),
  amount: z.number().int().positive(),
  note: z.string().max(200).optional(),
  date: isoDateSchema,
});

export type AddContributionInput = z.infer<typeof addContributionSchema>;

export type GoalType = z.infer<typeof goalTypeSchema>;

export type Goal = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly type: GoalType;
  readonly targetAmount: number;
  readonly targetDate: string | null;
  readonly interestRatePercent: number | null;
  readonly iconName: string | null;
  readonly colorHex: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
};

export type GoalContribution = {
  readonly id: string;
  readonly goalId: string;
  readonly userId: string;
  readonly amount: number;
  readonly note: string | null;
  readonly date: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
};
