import { describe, expect, it } from "vitest";
import { resolveChatComposerSend } from "@/features/ai-chat/lib/chat-composer";

describe("AI chat composer", () => {
  it("trims message text and clears the input after a send", () => {
    expect(resolveChatComposerSend({ text: "  comida este mes  ", disabled: false })).toEqual({
      canSend: true,
      message: "comida este mes",
      nextText: "",
    });
  });

  it("does not send empty or disabled messages", () => {
    expect(resolveChatComposerSend({ text: "   ", disabled: false })).toEqual({
      canSend: false,
      message: null,
      nextText: "   ",
    });
    expect(resolveChatComposerSend({ text: "hello", disabled: true })).toEqual({
      canSend: false,
      message: null,
      nextText: "hello",
    });
  });
});
