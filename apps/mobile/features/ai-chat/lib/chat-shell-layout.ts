type ChatShellInsetInput = {
  readonly composerHeight: number;
  readonly safeBottom: number;
};

type ChatComposerBottomOffsetInput = {
  readonly keyboardVisible: boolean;
  readonly safeBottom: number;
};

type ScrollToBottomVisibilityInput = {
  readonly isStreaming: boolean;
  readonly isAwayFromBottom: boolean;
  readonly hasListContent: boolean;
};

const MIN_COMPOSER_HEIGHT = 56;
const LIST_COMPOSER_GAP = 16;
const SCROLL_BUTTON_GAP = 12;

export const getChatShellBottomInset = ({
  composerHeight,
  safeBottom,
}: ChatShellInsetInput): number =>
  Math.max(composerHeight, MIN_COMPOSER_HEIGHT) + safeBottom + LIST_COMPOSER_GAP;

export const getScrollButtonBottomOffset = ({
  composerHeight,
  safeBottom,
}: ChatShellInsetInput): number =>
  getChatShellBottomInset({ composerHeight, safeBottom }) + SCROLL_BUTTON_GAP;

export const getChatComposerBottomOffset = ({
  keyboardVisible,
  safeBottom,
}: ChatComposerBottomOffsetInput): number => (keyboardVisible ? 0 : safeBottom);

export const shouldRenderScrollToBottom = ({
  hasListContent,
  isStreaming,
  isAwayFromBottom,
}: ScrollToBottomVisibilityInput): boolean => hasListContent && !isStreaming && isAwayFromBottom;
