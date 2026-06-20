import { describe, expect, it } from "vitest";
import {
  getChatComposerBottomOffset,
  getChatKeyboardOverlap,
  getChatShellBottomInset,
  getScrollButtonBottomOffset,
  shouldRenderScrollToBottom,
} from "@/features/ai-chat/lib/chat-shell-layout";

describe("AI chat shell layout", () => {
  it("reserves space below the list for the floating composer", () => {
    expect(getChatShellBottomInset({ composerHeight: 64, composerBottomOffset: 24 })).toBe(104);
  });

  it("positions scroll affordance above the floating composer", () => {
    expect(getScrollButtonBottomOffset({ composerHeight: 64, composerBottomOffset: 24 })).toBe(116);
  });

  it("measures keyboard overlap relative to the chat shell", () => {
    expect(getChatKeyboardOverlap({ keyboardTopY: 560, shellBottomY: 840 })).toBe(280);
    expect(getChatKeyboardOverlap({ keyboardTopY: 560, shellBottomY: 560 })).toBe(0);
    expect(getChatKeyboardOverlap({ keyboardTopY: null, shellBottomY: 840 })).toBe(0);
  });

  it("keeps the composer above the home indicator when the keyboard is closed", () => {
    expect(
      getChatComposerBottomOffset({
        keyboardOverlap: 280,
        keyboardVisible: false,
        safeBottom: 24,
      })
    ).toBe(24);
  });

  it("anchors the composer to the measured keyboard overlap when the keyboard is open", () => {
    expect(
      getChatComposerBottomOffset({
        keyboardOverlap: 280,
        keyboardVisible: true,
        safeBottom: 24,
      })
    ).toBe(280);
    expect(
      getChatComposerBottomOffset({
        keyboardOverlap: 0,
        keyboardVisible: true,
        safeBottom: 24,
      })
    ).toBe(0);
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
