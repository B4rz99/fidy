import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("../../supabase/functions/ai-chat/index.ts", "utf8");

describe("ai-chat Edge Function privacy boundary", () => {
  it("does not query plaintext financial tables while building advisor context", () => {
    expect(source).not.toContain('.from("transactions")');
    expect(source).not.toContain('.from("budgets")');
    expect(source).not.toContain('.from("goals")');
    expect(source).not.toContain('.from("goal_contributions")');
    expect(source).not.toContain('.from("transfers")');
    expect(source).not.toContain('.from("financial_accounts")');
    expect(source).not.toContain('.from("capture_evidence")');
    expect(source).not.toContain('.rpc("get_user_balance")');
  });

  it("requires the app-provided financial context packet for chat mode", () => {
    expect(source).toContain("financialContextPacket");
    expect(source).toContain("invalid_context_packet");
    expect(source).toContain("buildSystemPrompt({ packet: financialContextPacket })");
  });

  it("keeps saved memories in chat prompts through the app-provided packet", () => {
    expect(source).toContain("context.packet.memories");
    expect(source).toContain("## What you know about this user");
    expect(source).not.toContain('from("user_memories").select("fact, category")');
  });

  it("validates packet collections before building chat prompts", () => {
    expect(source).toContain("isOptionalArrayOf(value.memories, isMemorySummary)");
    expect(source).toContain("isOptionalArrayOf(value.goals, isGoalSummary)");
    expect(source).toContain('typeof value.targetAmount === "number"');
    expect(source).toContain("invalid_context_packet");
  });
});
