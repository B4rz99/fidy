import { z } from "zod";
import type {
  ChatMessageId,
  ChatSessionId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
  UserMemoryId,
} from "@/shared/types/branded";
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
    amount: z.number().int().positive(),
    categoryId: categoryIdSchema,
    description: z.string(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .transform((s) => s as IsoDate),
  }),
});

export const editActionSchema = z.object({
  type: z.literal("edit"),
  transactionId: z.string().transform((s) => s as TransactionId),
  data: z.object({
    amount: z.number().int().positive().optional(),
    categoryId: categoryIdSchema.optional(),
    description: z.string().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .transform((s) => s as IsoDate)
      .optional(),
  }),
});

export const deleteActionSchema = z.object({
  type: z.literal("delete"),
  transactionId: z.string().transform((s) => s as TransactionId),
  description: z.string(),
  amount: z.number().int().positive(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((s) => s as IsoDate),
});

export const chatActionSchema = z.discriminatedUnion("type", [
  addActionSchema,
  editActionSchema,
  deleteActionSchema,
]);
export type ChatAction = z.infer<typeof chatActionSchema>;

export type ChatSession = {
  readonly id: ChatSessionId;
  readonly userId: UserId;
  readonly title: string;
  readonly createdAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
};

export type ChatMessage = {
  readonly id: ChatMessageId;
  readonly sessionId: ChatSessionId;
  readonly role: ChatRole;
  readonly content: string;
  readonly action: ChatAction | null;
  readonly actionStatus: ActionStatus | null;
  readonly createdAt: IsoDateTime;
};

export type UserMemory = {
  readonly id: UserMemoryId;
  readonly userId: UserId;
  readonly fact: string;
  readonly category: MemoryCategory;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
};
