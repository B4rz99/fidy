import { createElement, type ComponentType, type ReactNode } from "react";
import { vi } from "vitest";

const createNoop = () => () => undefined;

export const View = "View";
export const Text = "Text";
export const TextInput = "TextInput";
export const Pressable = "Pressable";
export const ScrollView = "ScrollView";
export function FlatList({
  data = [],
  keyExtractor,
  ListHeaderComponent,
  renderItem,
  ...props
}: {
  readonly data?: readonly unknown[];
  readonly keyExtractor?: (item: unknown, index: number) => string;
  readonly ListHeaderComponent?: ComponentType | ReactNode;
  readonly renderItem?: (input: { readonly item: unknown; readonly index: number }) => ReactNode;
}) {
  const header =
    typeof ListHeaderComponent === "function"
      ? createElement(ListHeaderComponent as ComponentType)
      : ListHeaderComponent;
  const headerChildren =
    header === null || header === undefined || header === false ? [] : [header];
  const items =
    renderItem === undefined
      ? []
      : data.map((item, index) =>
          createElement(
            View,
            { key: keyExtractor?.(item, index) ?? String(index) },
            renderItem({ item, index })
          )
        );
  return createElement("FlatList", props, ...headerChildren, ...items);
}
export const SectionList = "SectionList";
export const Switch = "Switch";
export const Image = "Image";
export const Modal = "Modal";
export const ActivityIndicator = "ActivityIndicator";
export const KeyboardAvoidingView = "KeyboardAvoidingView";
export const ActionSheetIOS = { showActionSheetWithOptions: vi.fn(createNoop()) };
export const Alert = { alert: vi.fn(createNoop()) };
export const Appearance = { setColorScheme: vi.fn(createNoop()) };
export const StyleSheet = {
  create: (styles: Record<string, unknown>) => styles,
  flatten: (style: unknown) =>
    Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style,
  absoluteFillObject: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
  hairlineWidth: 1,
};
export const Keyboard = { dismiss: createNoop() };
export const Linking = {
  openSettings: vi.fn(createNoop()),
  sendIntent: vi.fn(() => Promise.resolve()),
};
export const Platform = {
  OS: "ios",
  select: (obj: Record<string, unknown>) => obj[Platform.OS] ?? obj.default,
};
export const useColorScheme = () => "light";
export const useWindowDimensions = () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
export const AccessibilityInfo = {
  announceForAccessibility: vi.fn(createNoop()),
};
export const AppState = {
  addEventListener: vi.fn(() => ({ remove: createNoop() })),
};

class AnimatedValue {
  readonly value: number;

  constructor(value: number) {
    this.value = value;
  }
}

export const Animated = {
  Text,
  Value: AnimatedValue,
  timing: vi.fn(() => ({
    start: vi.fn(createNoop()),
  })),
};
