import type { FlashListRef } from "@shopify/flash-list";
import { FlashList } from "@shopify/flash-list";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useReducer, useRef, type ElementRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconActionButton } from "@/shared/components";
import { SCROLL_TO_BOTTOM_ICON_COLOR } from "@/shared/components/effect-tokens";
import { ChevronLeft } from "@/shared/components/icons";
import {
  Keyboard,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "@/shared/components/rn";
import {
  getChatComposerBottomOffset,
  getChatKeyboardOverlap,
  getChatShellBottomInset,
  getScrollButtonBottomOffset,
  shouldRenderScrollToBottom,
} from "../lib/chat-shell-layout";
import {
  shouldAutoScrollForContentChange,
  shouldShowScrollToBottom,
} from "../lib/conversation-scroll";
import type { ChatMessage } from "../schema";

type ChatConversationShellProps = {
  readonly messages: readonly ChatMessage[];
  readonly renderMessage: (info: { item: ChatMessage }) => ReactElement;
  readonly keyExtractor: (item: ChatMessage) => string;
  readonly isStreaming: boolean;
  readonly streamingBubble: ReactElement;
  readonly emptyState: ReactNode;
  readonly composer: ReactNode;
  readonly scrollToBottomLabel: string;
};

type ChatShellState = {
  readonly composerHeight: number;
  readonly keyboardVisible: boolean;
  readonly keyboardTopY: number | null;
  readonly shellBottomY: number | null;
  readonly showScrollToBottom: boolean;
};

type ChatShellAction =
  | { readonly type: "setComposerHeight"; readonly composerHeight: number }
  | { readonly type: "setKeyboardVisible"; readonly keyboardVisible: boolean }
  | { readonly type: "setKeyboardTopY"; readonly keyboardTopY: number | null }
  | { readonly type: "setShellBottomY"; readonly shellBottomY: number | null }
  | { readonly type: "setShowScrollToBottom"; readonly showScrollToBottom: boolean };

const initialChatShellState: ChatShellState = {
  composerHeight: 64,
  keyboardVisible: false,
  keyboardTopY: null,
  shellBottomY: null,
  showScrollToBottom: false,
};

function chatShellReducer(state: ChatShellState, action: ChatShellAction): ChatShellState {
  switch (action.type) {
    case "setComposerHeight":
      return { ...state, composerHeight: action.composerHeight };
    case "setKeyboardVisible":
      return { ...state, keyboardVisible: action.keyboardVisible };
    case "setKeyboardTopY":
      return { ...state, keyboardTopY: action.keyboardTopY };
    case "setShellBottomY":
      return { ...state, shellBottomY: action.shellBottomY };
    case "setShowScrollToBottom":
      return { ...state, showScrollToBottom: action.showScrollToBottom };
  }
}

function subscribeKeyboardVisibility({
  measureShellBottom,
  setKeyboardTopY,
  setKeyboardVisible,
}: {
  readonly measureShellBottom: () => void;
  readonly setKeyboardTopY: (topY: number | null) => void;
  readonly setKeyboardVisible: (visible: boolean) => void;
}) {
  const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
  const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
  const showSub = Keyboard.addListener(showEvent, (event) => {
    measureShellBottom();
    setKeyboardTopY(event.endCoordinates.screenY);
    setKeyboardVisible(true);
  });
  const hideSub = Keyboard.addListener(hideEvent, () => {
    setKeyboardTopY(null);
    setKeyboardVisible(false);
  });

  return () => {
    showSub.remove();
    hideSub.remove();
  };
}

export function ChatConversationShell({
  messages,
  renderMessage,
  keyExtractor,
  isStreaming,
  streamingBubble,
  emptyState,
  composer,
  scrollToBottomLabel,
}: ChatConversationShellProps) {
  const listRef = useRef<FlashListRef<ChatMessage>>(null);
  const shellRef = useRef<ElementRef<typeof View>>(null);
  const { bottom: safeBottom } = useSafeAreaInsets();
  const [shellState, dispatchShell] = useReducer(chatShellReducer, initialChatShellState);
  const { composerHeight, keyboardVisible, keyboardTopY, shellBottomY, showScrollToBottom } =
    shellState;
  const keyboardOverlap = getChatKeyboardOverlap({ keyboardTopY, shellBottomY });
  const composerBottomOffset = getChatComposerBottomOffset({
    keyboardOverlap,
    keyboardVisible,
    safeBottom,
  });
  const bottomInset = getChatShellBottomInset({ composerHeight, composerBottomOffset });
  const scrollButtonBottom = getScrollButtonBottomOffset({
    composerHeight,
    composerBottomOffset,
  });
  const scrollMetricsRef = useRef({
    contentHeight: 0,
    viewportHeight: 0,
    scrollOffsetY: 0,
    bottomInset,
  });

  const measureShellBottom = () => {
    shellRef.current?.measureInWindow((_x, y, _width, height) => {
      dispatchShell({ type: "setShellBottomY", shellBottomY: y + height });
    });
  };

  const scrollToBottom = (animated = true) => {
    listRef.current?.scrollToEnd({ animated });
  };

  const updateScrollButton = () => {
    dispatchShell({
      type: "setShowScrollToBottom",
      showScrollToBottom: shouldShowScrollToBottom(scrollMetricsRef.current),
    });
  };

  const handleComposerLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    const nextBottomInset = getChatShellBottomInset({
      composerBottomOffset,
      composerHeight: nextHeight,
    });
    dispatchShell({ type: "setComposerHeight", composerHeight: nextHeight });
    scrollMetricsRef.current = {
      ...scrollMetricsRef.current,
      bottomInset: nextBottomInset,
    };
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollMetricsRef.current = {
      ...scrollMetricsRef.current,
      scrollOffsetY: event.nativeEvent.contentOffset.y,
      viewportHeight: event.nativeEvent.layoutMeasurement.height,
      bottomInset,
    };
    updateScrollButton();
  };

  const handleListLayout = (event: LayoutChangeEvent) => {
    scrollMetricsRef.current = {
      ...scrollMetricsRef.current,
      viewportHeight: event.nativeEvent.layout.height,
      bottomInset,
    };
    updateScrollButton();
  };

  const handleContentSizeChange = (_width: number, height: number) => {
    const metrics = { ...scrollMetricsRef.current, bottomInset };
    const shouldScroll = shouldAutoScrollForContentChange({
      previousContentHeight: metrics.contentHeight,
      nextContentHeight: height,
      viewportHeight: metrics.viewportHeight,
      scrollOffsetY: metrics.scrollOffsetY,
      bottomInset,
    });
    scrollMetricsRef.current = { ...metrics, contentHeight: height };
    updateScrollButton();
    if (shouldScroll) {
      requestAnimationFrame(() => scrollToBottom(false));
    }
  };

  useEffect(() => {
    return subscribeKeyboardVisibility({
      measureShellBottom,
      setKeyboardTopY: (keyboardTopY) => {
        dispatchShell({ type: "setKeyboardTopY", keyboardTopY });
      },
      setKeyboardVisible: (keyboardVisible) => {
        dispatchShell({ type: "setKeyboardVisible", keyboardVisible });
      },
    });
  }, []);

  return (
    <View ref={shellRef} onLayout={measureShellBottom} style={{ flex: 1 }}>
      {messages.length === 0 && !isStreaming ? (
        emptyState
      ) : (
        <FlashList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: bottomInset,
          }}
          contentInset={{ bottom: bottomInset }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          onLayout={handleListLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={handleContentSizeChange}
          ListFooterComponent={isStreaming ? streamingBubble : null}
        />
      )}

      {shouldRenderScrollToBottom({
        hasListContent: messages.length > 0 || isStreaming,
        isStreaming,
        isAwayFromBottom: showScrollToBottom,
      }) ? (
        <IconActionButton
          accessibilityLabel={scrollToBottomLabel}
          onPress={() => scrollToBottom()}
          icon={
            <ChevronLeft
              size={20}
              color={SCROLL_TO_BOTTOM_ICON_COLOR}
              style={{ transform: [{ rotate: "-90deg" }] }}
            />
          }
          size="size-10"
          style={[styles.scrollToBottomButton, { bottom: scrollButtonBottom }]}
        />
      ) : null}

      <View
        onLayout={handleComposerLayout}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: composerBottomOffset,
        }}
      >
        {composer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollToBottomButton: {
    position: "absolute",
    right: 16,
  },
});
