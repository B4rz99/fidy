import type { FlashListRef } from "@shopify/flash-list";
import { FlashList } from "@shopify/flash-list";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "@/shared/components/icons";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "@/shared/components/rn";
import {
  getChatComposerBottomOffset,
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

function subscribeKeyboardVisibility(setKeyboardVisible: (visible: boolean) => void) {
  const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
  const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
  const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
  const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

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
  const { bottom: safeBottom } = useSafeAreaInsets();
  const [composerHeight, setComposerHeight] = useState(64);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const bottomInset = getChatShellBottomInset({ composerHeight, safeBottom });
  const scrollButtonBottom = getScrollButtonBottomOffset({ composerHeight, safeBottom });
  const scrollMetricsRef = useRef({
    contentHeight: 0,
    viewportHeight: 0,
    scrollOffsetY: 0,
    bottomInset,
  });

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  const updateScrollButton = useCallback(() => {
    setShowScrollToBottom(shouldShowScrollToBottom(scrollMetricsRef.current));
  }, []);

  const handleComposerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = event.nativeEvent.layout.height;
      const nextBottomInset = getChatShellBottomInset({
        composerHeight: nextHeight,
        safeBottom,
      });
      setComposerHeight(nextHeight);
      scrollMetricsRef.current = {
        ...scrollMetricsRef.current,
        bottomInset: nextBottomInset,
      };
    },
    [safeBottom]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollMetricsRef.current = {
        ...scrollMetricsRef.current,
        scrollOffsetY: event.nativeEvent.contentOffset.y,
        viewportHeight: event.nativeEvent.layoutMeasurement.height,
        bottomInset,
      };
      updateScrollButton();
    },
    [bottomInset, updateScrollButton]
  );

  const handleListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scrollMetricsRef.current = {
        ...scrollMetricsRef.current,
        viewportHeight: event.nativeEvent.layout.height,
        bottomInset,
      };
      updateScrollButton();
    },
    [bottomInset, updateScrollButton]
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
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
    },
    [bottomInset, scrollToBottom, updateScrollButton]
  );

  useEffect(() => {
    return subscribeKeyboardVisibility(setKeyboardVisible);
  }, []);

  return (
    <View style={{ flex: 1 }}>
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
            paddingBottom: 12,
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scrollToBottomLabel}
          onPress={() => scrollToBottom()}
          style={[styles.scrollToBottomButton, { bottom: scrollButtonBottom }]}
        >
          <ChevronLeft size={20} color="#fff" style={{ transform: [{ rotate: "-90deg" }] }} />
        </Pressable>
      ) : null}

      <View
        onLayout={handleComposerLayout}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: getChatComposerBottomOffset({ keyboardVisible, safeBottom }),
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.64)",
    alignItems: "center",
    justifyContent: "center",
  },
});
