// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { vi } from "vitest";

process.env.EXPO_PUBLIC_GMAIL_CLIENT_ID = "test-gmail-client-id.apps.googleusercontent.com";
process.env.EXPO_PUBLIC_OUTLOOK_CLIENT_ID = "test-outlook-client-id";

const { safeAreaContextMock } = vi.hoisted(() => {
  const zeroInsets = { top: 0, bottom: 0, left: 0, right: 0 };

  return {
    safeAreaContextMock: {
      useSafeAreaInsets: () => zeroInsets,
      SafeAreaProvider: "SafeAreaProvider",
    },
  };
});

const { lucideReactNativeMock } = vi.hoisted(() => {
  const iconNames = [
    "ArrowLeftRight",
    "Baby",
    "Banknote",
    "BarChart3",
    "Bell",
    "Book",
    "Brain",
    "Briefcase",
    "Building2",
    "Calendar",
    "Car",
    "Check",
    "CheckCircle",
    "ChevronLeft",
    "ChevronRight",
    "CircleCheck",
    "Clapperboard",
    "Clock",
    "Coffee",
    "Delete",
    "Dog",
    "Dumbbell",
    "Ellipsis",
    "ExternalLink",
    "FileText",
    "Film",
    "Fuel",
    "Gamepad2",
    "Gift",
    "GitMerge",
    "Globe",
    "GraduationCap",
    "Heart",
    "HeartPulse",
    "HelpCircle",
    "Home",
    "House",
    "Info",
    "LogOut",
    "Mail",
    "Menu",
    "MessageSquare",
    "Monitor",
    "Music",
    "Palette",
    "PawPrint",
    "Pencil",
    "PiggyBank",
    "Plane",
    "Plus",
    "Receipt",
    "Scissors",
    "Search",
    "SendHorizonal",
    "Settings",
    "Shield",
    "Shirt",
    "ShoppingBag",
    "ShoppingCart",
    "Smartphone",
    "Sparkles",
    "Star",
    "Stethoscope",
    "Tag",
    "Target",
    "Trash2",
    "TrendingUp",
    "TriangleAlert",
    "Trophy",
    "Umbrella",
    "User",
    "Utensils",
    "Wallet",
    "Wifi",
    "Wine",
    "Wrench",
    "X",
    "Zap",
  ];

  return {
    lucideReactNativeMock: Object.fromEntries(
      iconNames.map((iconName) => [iconName, iconName])
    ) as Record<string, string>,
  };
});

// Mock react-native (Flow syntax not supported outside RN bundler)
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  FlatList: "FlatList",
  Switch: "Switch",
  Image: "Image",
  ActivityIndicator: "ActivityIndicator",
  ActionSheetIOS: { showActionSheetWithOptions: vi.fn() },
  Alert: { alert: vi.fn() },
  Appearance: { setColorScheme: vi.fn() },
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Keyboard: { dismiss: vi.fn() },
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Linking: {
    openSettings: vi.fn(),
    sendIntent: vi.fn(() => Promise.resolve()),
  },
  Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj.ios },
  useColorScheme: () => "light",
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

// Mock react-native-safe-area-context
vi.mock("react-native-safe-area-context", () => safeAreaContextMock);

// Mock lucide-react-native
vi.mock("lucide-react-native", () => lucideReactNativeMock);

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

// Mock @shopify/flash-list
vi.mock("@shopify/flash-list", () => ({
  FlashList: "FlashList",
}));

// Mock react-native-gesture-handler
vi.mock("react-native-gesture-handler", () => {
  const gesture = () => ({
    minDuration: () => gesture(),
    onBegin: () => gesture(),
    onStart: () => gesture(),
    onFinalize: () => gesture(),
  });
  return {
    Gesture: { LongPress: gesture },
    GestureDetector: "GestureDetector",
    GestureHandlerRootView: "GestureHandlerRootView",
  };
});

// Mock react-native-reanimated
vi.mock("react-native-reanimated", () => {
  const Animated = {
    View: "Animated.View",
  };
  return {
    default: Animated,
    FadeIn: { duration: () => ({ duration: () => "FadeIn" }) },
    FadeOut: { duration: () => ({ duration: () => "FadeOut" }) },
    // biome-ignore lint/suspicious/noExplicitAny: mock needs flexible typing
    useAnimatedStyle: (fn: any) => fn(),
    // biome-ignore lint/suspicious/noExplicitAny: mock needs flexible typing
    useSharedValue: (init: any) => ({ value: init }),
    // biome-ignore lint/suspicious/noExplicitAny: mock needs flexible typing
    withTiming: (val: any) => val,
    // biome-ignore lint/suspicious/noExplicitAny: mock needs flexible typing
    withRepeat: (val: any) => val,
    // biome-ignore lint/suspicious/noExplicitAny: mock needs flexible typing
    withSequence: (...vals: any[]) => vals[0],
    cancelAnimation: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: mock needs flexible typing
    runOnJS: (fn: any) => fn,
  };
});

// Mock expo-sqlite
vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => ({ execSync: vi.fn(), closeSync: vi.fn() })),
  deleteDatabaseAsync: vi.fn(() => Promise.resolve()),
}));

// Note: date-fns is NOT mocked globally. Tests that need deterministic date
// behavior should mock it at the file level with vi.mock or vi.doMock.

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

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
      upsert: vi.fn(() => ({ error: null })),
      delete: vi.fn(() => ({ error: null })),
    })),
  })),
}));

// Mock expo-secure-store
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  setItemAsync: vi.fn(() => Promise.resolve()),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

// Mock expo-crypto
vi.mock("expo-crypto", () => ({
  getRandomBytes: vi.fn(() => new Uint8Array(32)),
}));

// Mock @react-native-community/datetimepicker
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
}));

// Mock @react-native-community/netinfo
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
    fetch: vi.fn(() => Promise.resolve({ isConnected: true })),
  },
}));

// Mock expo-web-browser
vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: vi.fn(() => Promise.resolve({ type: "dismiss" })),
  maybeCompleteAuthSession: vi.fn(),
  openBrowserAsync: vi.fn(),
}));

// Mock @sentry/react-native
vi.mock("@sentry/react-native", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  withScope: vi.fn((cb: (scope: unknown) => void) =>
    cb({ setContext: vi.fn(), setLevel: vi.fn() })
  ),
  ErrorBoundary: "SentryErrorBoundary",
  wrap: vi.fn((component: unknown) => component),
}));

// Mock burnt
vi.mock("burnt", () => ({
  toast: vi.fn(),
}));

// Mock expo-updates
vi.mock("expo-updates", () => ({
  reloadAsync: vi.fn(),
}));

// Mock expo-background-task
vi.mock("expo-background-task", () => ({
  registerTaskAsync: vi.fn(),
  unregisterTaskAsync: vi.fn(),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));

// Mock expo-task-manager
vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn().mockResolvedValue(false),
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
  Polyline: "Polyline",
  Defs: "Defs",
  LinearGradient: "LinearGradient",
  Stop: "Stop",
}));

// Mock expo-android-notification-listener-service
vi.mock("expo-android-notification-listener-service", () => ({
  addListener: vi.fn(() => ({ remove: vi.fn() })),
  setAllowedPackages: vi.fn(),
  isPermissionGranted: vi.fn(() => Promise.resolve(false)),
}));

// Mock @fidy/assets (monorepo package with SVG logo paths)
vi.mock("@fidy/assets", () => ({
  LOGO_COIN: { cx: 0, cy: 0, r: 10 },
  LOGO_COLORS: {
    light: { coin: "#000", dollar: "#000", text: "#000" },
    dark: { coin: "#fff", dollar: "#fff", text: "#fff" },
  },
  LOGO_DOLLAR_PATH: "M0 0",
  LOGO_TEXT_PATH: "M0 0",
}));

// Mock expo-notifications
vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  getPermissionsAsync: vi.fn(() =>
    Promise.resolve({ status: "undetermined", granted: false, canAskAgain: true })
  ),
  requestPermissionsAsync: vi.fn(() =>
    Promise.resolve({ status: "granted", granted: true, canAskAgain: true })
  ),
  setNotificationHandler: vi.fn(),
  getExpoPushTokenAsync: vi.fn(() => Promise.resolve({ data: "ExponentPushToken[mock]" })),
  addPushTokenListener: vi.fn(() => ({ remove: vi.fn() })),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
}));

// Mock expo-constants
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      version: "0.0.1",
      extra: { eas: { projectId: "test-project-id" } },
    },
  },
}));

// Mock expo native module bridge (used by local expo-app-intents module)
vi.mock("expo", () => ({
  requireNativeModule: vi.fn(() => ({
    isAvailable: vi.fn(() => false),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  })),
}));

// Mock posthog-react-native (native module, not transformable in Vitest node env)
vi.mock("posthog-react-native", () => ({
  default: class {
    identify = vi.fn();
    capture = vi.fn();
    reset = vi.fn();
  },
}));
