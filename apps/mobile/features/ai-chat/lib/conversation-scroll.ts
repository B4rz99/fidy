type ScrollMetrics = {
  readonly viewportHeight: number;
  readonly scrollOffsetY: number;
  readonly bottomInset: number;
};

type ContentChangeMetrics = ScrollMetrics & {
  readonly previousContentHeight: number;
  readonly nextContentHeight: number;
};

type CurrentScrollMetrics = ScrollMetrics & {
  readonly contentHeight: number;
};

const NEAR_BOTTOM_THRESHOLD = 64;

const distanceFromBottom = ({
  contentHeight,
  viewportHeight,
  scrollOffsetY,
}: CurrentScrollMetrics): number => Math.max(0, contentHeight - viewportHeight - scrollOffsetY);

export const shouldShowScrollToBottom = (metrics: CurrentScrollMetrics): boolean =>
  distanceFromBottom(metrics) > NEAR_BOTTOM_THRESHOLD;

export const shouldAutoScrollForContentChange = ({
  previousContentHeight,
  nextContentHeight,
  viewportHeight,
  scrollOffsetY,
  bottomInset,
}: ContentChangeMetrics): boolean =>
  nextContentHeight > previousContentHeight &&
  !shouldShowScrollToBottom({
    contentHeight: previousContentHeight,
    viewportHeight,
    scrollOffsetY,
    bottomInset,
  });
