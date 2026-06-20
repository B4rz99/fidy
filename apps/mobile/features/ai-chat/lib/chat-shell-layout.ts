type ChatShellInsetInput = {
  readonly composerHeight: number;
  readonly composerBottomOffset: number;
};

type ChatComposerBottomOffsetInput = {
  readonly keyboardVisible: boolean;
  readonly keyboardOverlap: number;
  readonly safeBottom: number;
};

type ChatKeyboardOverlapInput = {
  readonly keyboardTopY: number | null;
  readonly shellBottomY: number | null;
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
  composerBottomOffset,
}: ChatShellInsetInput): number =>
  Math.max(composerHeight, MIN_COMPOSER_HEIGHT) + composerBottomOffset + LIST_COMPOSER_GAP;

export const getScrollButtonBottomOffset = ({
  composerHeight,
  composerBottomOffset,
}: ChatShellInsetInput): number =>
  getChatShellBottomInset({ composerHeight, composerBottomOffset }) + SCROLL_BUTTON_GAP;

export const getChatKeyboardOverlap = ({
  keyboardTopY,
  shellBottomY,
}: ChatKeyboardOverlapInput): number =>
  keyboardTopY == null || shellBottomY == null ? 0 : Math.max(0, shellBottomY - keyboardTopY);

export const getChatComposerBottomOffset = ({
  keyboardVisible,
  keyboardOverlap,
  safeBottom,
}: ChatComposerBottomOffsetInput): number => (keyboardVisible ? keyboardOverlap : safeBottom);

export const shouldRenderScrollToBottom = ({
  hasListContent,
  isStreaming,
  isAwayFromBottom,
}: ScrollToBottomVisibilityInput): boolean => hasListContent && !isStreaming && isAwayFromBottom;
