const createNoop = () => () => undefined;

export const View = "View";
export const Text = "Text";
export const TextInput = "TextInput";
export const Pressable = "Pressable";
export const ScrollView = "ScrollView";
export const FlatList = "FlatList";
export const SectionList = "SectionList";
export const Switch = "Switch";
export const Image = "Image";
export const Modal = "Modal";
export const ActivityIndicator = "ActivityIndicator";
export const KeyboardAvoidingView = "KeyboardAvoidingView";
export const ActionSheetIOS = { showActionSheetWithOptions: createNoop() };
export const Alert = { alert: createNoop() };
export const Appearance = { setColorScheme: createNoop() };
export const StyleSheet = { create: (styles: Record<string, unknown>) => styles };
export const Keyboard = { dismiss: createNoop() };
export const Linking = {
  openSettings: createNoop(),
  sendIntent: () => Promise.resolve(),
};
export const Platform = {
  OS: "ios",
  select: (obj: Record<string, unknown>) => obj[Platform.OS] ?? obj.default,
};
export const useColorScheme = () => "light";
export const useWindowDimensions = () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
export const AccessibilityInfo = {
  announceForAccessibility: createNoop(),
};
export const AppState = {
  addEventListener: () => ({ remove: createNoop() }),
};
