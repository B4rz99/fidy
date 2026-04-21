import { z } from "zod";

const goalTypeSchema = z.enum(["savings", "debt"]);
const goalNameSchema = z.string().min(1).max(100);
const targetAmountSchema = z.number().int().positive();
const interestRatePercentSchema = z.number().min(0).max(100);
const iconNameSchema = z.string();
const colorHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

function isValidCalendarDate(value: string): boolean {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return [date.getFullYear() === year, date.getMonth() === month - 1, date.getDate() === day].every(
    Boolean
  );
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidCalendarDate, "Invalid calendar date");

export const createGoalSchema = z.object({
  name: goalNameSchema,
  type: goalTypeSchema,
  targetAmount: targetAmountSchema,
  targetDate: isoDateSchema.optional(),
  interestRatePercent: interestRatePercentSchema.optional(),
  iconName: iconNameSchema.optional(),
  colorHex: colorHexSchema.optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = z
  .object({
    name: goalNameSchema.optional(),
    targetAmount: targetAmountSchema.optional(),
    targetDate: isoDateSchema.nullable().optional(),
    interestRatePercent: interestRatePercentSchema.nullable().optional(),
    iconName: iconNameSchema.nullable().optional(),
    colorHex: colorHexSchema.nullable().optional(),
  })
  .strict();

export type GoalUpdateInput = z.infer<typeof updateGoalSchema>;

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
