import { describe, expect, it } from "vitest";
import {
  getChatComposerBottomOffset,
  getChatShellBottomInset,
  getScrollButtonBottomOffset,
  shouldRenderScrollToBottom,
} from "@/features/ai-chat/lib/chat-shell-layout";

describe("AI chat shell layout", () => {
  it("reserves space below the list for the floating composer", () => {
    expect(getChatShellBottomInset({ composerHeight: 64, safeBottom: 24 })).toBe(104);
  });

  it("positions scroll affordance above the floating composer", () => {
    expect(getScrollButtonBottomOffset({ composerHeight: 64, safeBottom: 24 })).toBe(116);
  });

  it("keeps the composer above the home indicator when the keyboard is closed", () => {
    expect(getChatComposerBottomOffset({ keyboardVisible: false, safeBottom: 24 })).toBe(24);
  });

  it("anchors the composer flush to the keyboard when the keyboard is open", () => {
    expect(getChatComposerBottomOffset({ keyboardVisible: true, safeBottom: 24 })).toBe(0);
  });

  it("does not show the scroll affordance while a response is streaming", () => {
    expect(
      shouldRenderScrollToBottom({
        hasListContent: true,
        isStreaming: true,
        isAwayFromBottom: true,
      })
    ).toBe(false);
  });

  it("does not show the scroll affordance without list content", () => {
    expect(
      shouldRenderScrollToBottom({
        hasListContent: false,
        isStreaming: false,
        isAwayFromBottom: true,
      })
    ).toBe(false);
  });
});
