import { z } from "zod";
import { requireIsoDate, requireTransactionId } from "@/shared/types/assertions";
import type { ChatMessageId, ChatSessionId, IsoDateTime, UserId } from "@/shared/types/branded";
import { categoryIdSchema, transactionTypeSchema } from "../transactions/schema";

export const chatRoleSchema = z.enum(["user", "assistant"]);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const actionStatusSchema = z.enum(["pending", "confirmed", "dismissed"]);
export type ActionStatus = z.infer<typeof actionStatusSchema>;

const actionIsoDateSchema = z.string().transform((value, ctx) => {
  try {
    return requireIsoDate(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid ISO date" });
    return z.NEVER;
  }
});

const actionTransactionIdSchema = z
  .string()
  .trim()
  .min(1, "Transaction ID is required")
  .transform((value, ctx) => {
    try {
      return requireTransactionId(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Transaction ID is required" });
      return z.NEVER;
    }
  });

export const addActionSchema = z.object({
  type: z.literal("add"),
  data: z.object({
    type: transactionTypeSchema,
    amount: z.number().int().positive(),
    categoryId: categoryIdSchema,
    description: z.string(),
    date: actionIsoDateSchema,
  }),
});

export const editActionSchema = z.object({
  type: z.literal("edit"),
  transactionId: actionTransactionIdSchema,
  data: z.object({
    amount: z.number().int().positive().optional(),
    categoryId: categoryIdSchema.optional(),
    description: z.string().optional(),
    date: actionIsoDateSchema.optional(),
  }),
});

export const deleteActionSchema = z.object({
  type: z.literal("delete"),
  transactionId: actionTransactionIdSchema,
  description: z.string(),
  amount: z.number().int().positive(),
  date: actionIsoDateSchema,
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
