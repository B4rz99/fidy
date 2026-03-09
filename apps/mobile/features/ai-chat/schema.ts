import { z } from "zod";
import { categoryIdSchema, transactionTypeSchema } from "../transactions/schema";

export const memoryCategory = z.enum(["habit", "preference", "situation", "goal"]);
export type MemoryCategory = z.infer<typeof memoryCategory>;

export const chatRoleSchema = z.enum(["user", "assistant"]);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const actionStatusSchema = z.enum(["pending", "confirmed", "dismissed"]);
export type ActionStatus = z.infer<typeof actionStatusSchema>;

export const addActionSchema = z.object({
  type: z.literal("add"),
  data: z.object({
    type: transactionTypeSchema,
    amountCents: z.number().int().positive(),
    categoryId: categoryIdSchema,
    description: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export const editActionSchema = z.object({
  type: z.literal("edit"),
  transactionId: z.string(),
  data: z.object({
    amountCents: z.number().int().positive().optional(),
    categoryId: categoryIdSchema.optional(),
    description: z.string().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
});

export const deleteActionSchema = z.object({
  type: z.literal("delete"),
  transactionId: z.string(),
  description: z.string(),
  amountCents: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const chatActionSchema = z.discriminatedUnion("type", [
  addActionSchema,
  editActionSchema,
  deleteActionSchema,
]);
export type ChatAction = z.infer<typeof chatActionSchema>;

export type ChatSession = {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly deletedAt: string | null;
};

export type ChatMessage = {
  readonly id: string;
  readonly sessionId: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly action: ChatAction | null;
  readonly actionStatus: ActionStatus | null;
  readonly createdAt: string;
};

export type UserMemory = {
  readonly id: string;
  readonly userId: string;
  readonly fact: string;
  readonly category: MemoryCategory;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export const extractedMemorySchema = z.object({
  fact: z.string(),
  category: memoryCategory,
});
export type ExtractedMemory = z.infer<typeof extractedMemorySchema>;
