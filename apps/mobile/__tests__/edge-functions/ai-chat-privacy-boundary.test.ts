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

  it("does not read or prompt with saved memories", () => {
    expect(source).not.toContain("context.packet.memories");
    expect(source).not.toContain("## What you know about this user");
    expect(source).not.toContain('from("user_memories")');
    expect(source).not.toContain("extract_memories");
  });

  it("validates packet collections before building chat prompts", () => {
    expect(source).toContain("readFinancialContextPacket(body.financialContextPacket)");
    expect(source).not.toContain("isUnknownItem");
    expect(source).toContain("invalid_context_packet");
  });

  it("keeps advisor prompts scoped to the packet task", () => {
    expect(source).toContain("## Financial context task");
    expect(source).toContain("context.packet.task.kind");
  });
});
