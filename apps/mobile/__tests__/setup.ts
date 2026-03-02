// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { vi } from "vitest";

// Mock react-native (Flow syntax not supported outside RN bundler)
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
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
}));

// Mock nativewind/preset (needed for tailwind config import)
vi.mock("nativewind/preset", () => ({ default: {} }));

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
