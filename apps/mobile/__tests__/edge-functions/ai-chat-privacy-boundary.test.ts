import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyAiChatInternalError } from "../../../../supabase/functions/ai-chat/error-classification";

const source = readFileSync(
  new URL("../../../../supabase/functions/ai-chat/index.ts", import.meta.url),
  "utf8"
);

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
    expect(source).toContain("inferFinancialContextPacketTaskFromMessages(messages)");
    expect(source).toContain("readFinancialContextPacket(");
    expect(source).toContain("financialContextPacketTask");
    expect(source).not.toContain("isUnknownItem");
    expect(source).toContain("invalid_context_packet");
  });

  it("keeps advisor prompts scoped to the packet task", () => {
    expect(source).toContain("## Financial context task");
    expect(source).toContain("context.packet.task.kind");
  });

  it("uses stable log error codes instead of raw financial exception messages", () => {
    const errorType = classifyAiChatInternalError(
      new Error("OpenAI echoed EXITO purchase for 50000 COP on card 1234 from account Bancolombia")
    );
    const sdkEchoErrorType = classifyAiChatInternalError({
      code: "exito_50000_card_1234",
      param: "account_bancolombia",
      type: "proxy_error",
    });
    const logPayload = JSON.stringify({ error_type: errorType, sdk_error_type: sdkEchoErrorType });

    expect(errorType).toBe("internal_error");
    expect(sdkEchoErrorType).toBe("openai_error");
    expect(source).toContain("classifyAiChatInternalError(err)");
    expect(source).not.toContain("error_type: message");
    expect(source).not.toContain("error_type: errorMsg");
    expect(logPayload).not.toContain("exito");
    expect(logPayload).not.toContain("EXITO");
    expect(logPayload).not.toContain("50000");
    expect(logPayload).not.toContain("1234");
    expect(logPayload).not.toContain("bancolombia");
    expect(logPayload).not.toContain("Bancolombia");
  });
});
