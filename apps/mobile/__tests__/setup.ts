// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { vi } from "vitest";

// Mock react-native (Flow syntax not supported outside RN bundler)
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  Keyboard: { dismiss: vi.fn() },
  useColorScheme: () => "light",
}));

// Mock react-native-safe-area-context
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: "SafeAreaProvider",
}));

// Mock lucide-react-native
vi.mock("lucide-react-native", () => ({
  Home: "Home",
  Menu: "Menu",
  Wallet: "Wallet",
  Clock: "Clock",
  Sparkles: "Sparkles",
  Plus: "Plus",
  Banknote: "Banknote",
  Car: "Car",
  Coffee: "Coffee",
  Film: "Film",
  HeartPulse: "HeartPulse",
  Music: "Music",
  ShoppingBag: "ShoppingBag",
  Smartphone: "Smartphone",
  Wifi: "Wifi",
  Zap: "Zap",
  TrendingUp: "TrendingUp",
  Bell: "Bell",
  Utensils: "Utensils",
  Receipt: "Receipt",
  Ellipsis: "Ellipsis",
  ChevronLeft: "ChevronLeft",
  Calendar: "Calendar",
  X: "X",
}));

// Mock nativewind/preset (needed for tailwind config import)
vi.mock("nativewind/preset", () => ({ default: {} }));

// Mock expo-haptics
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  selectionAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium", Heavy: "Heavy" },
  NotificationFeedbackType: {
    Success: "Success",
    Warning: "Warning",
    Error: "Error",
  },
}));

// Mock @gorhom/bottom-sheet
vi.mock("@gorhom/bottom-sheet", () => ({
  default: "BottomSheet",
  BottomSheetModal: "BottomSheetModal",
  BottomSheetModalProvider: "BottomSheetModalProvider",
  BottomSheetView: "BottomSheetView",
  BottomSheetTextInput: "BottomSheetTextInput",
  BottomSheetBackdrop: "BottomSheetBackdrop",
}));

// Mock react-native-reanimated
vi.mock("react-native-reanimated", () => {
  const Animated = {
    View: "Animated.View",
  };
  return {
    default: Animated,
    FadeIn: { duration: () => ({ duration: () => "FadeIn" }) },
    FadeOut: { duration: () => ({ duration: () => "FadeOut" }) },
  };
});

// Mock date-fns
vi.mock("date-fns", () => ({
  format: (date: Date, fmt: string) => {
    if (fmt === "MMM d, yyyy") return "Mar 1, 2026";
    return date.toISOString();
  },
  isToday: () => true,
}));

// Mock expo-router
export const mockReplace = vi.fn();
export const mockPush = vi.fn();
export const mockBack = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
}));

// Mock @expo/vector-icons/Ionicons
vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: "Ionicons",
}));

// Mock react-native-svg
vi.mock("react-native-svg", () => ({
  default: "Svg",
  Svg: "Svg",
  Circle: "Circle",
  Rect: "Rect",
  Path: "Path",
  G: "G",
  Text: "SvgText",
  Line: "Line",
  Defs: "Defs",
  LinearGradient: "LinearGradient",
  Stop: "Stop",
}));
