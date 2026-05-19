// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { vi } from "vitest";

type MockImplementation<TArgs extends readonly unknown[] = [], TReturn = void> = (
  ...args: TArgs
) => TReturn;

const { createMock } = vi.hoisted(() => ({
  createMock: <TArgs extends readonly unknown[] = [], TReturn = void>(
    implementation?: MockImplementation<TArgs, TReturn>
  ) => vi.fn<MockImplementation<TArgs, TReturn>>(implementation),
}));

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
  ActionSheetIOS: { showActionSheetWithOptions: createMock() },
  Alert: { alert: createMock() },
  Appearance: { setColorScheme: createMock() },
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Keyboard: { dismiss: createMock() },
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Linking: {
    openSettings: createMock(),
    sendIntent: createMock(() => Promise.resolve()),
  },
  Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj.ios },
  useColorScheme: () => "light",
  AppState: {
    addEventListener: createMock(() => ({ remove: createMock() })),
  },
}));

// Mock react-native-safe-area-context
vi.mock("react-native-safe-area-context", () => safeAreaContextMock);

// Mock lucide-react-native
vi.mock("lucide-react-native", () => lucideReactNativeMock);

// Mock expo-image native component
vi.mock("expo-image", () => ({ Image: "Image" }));

// Mock expo-glass-effect native component
vi.mock("expo-glass-effect", () => ({
  GlassView: "GlassView",
  GlassContainer: "GlassContainer",
  isLiquidGlassAvailable: () => false,
  isGlassEffectAPIAvailable: () => false,
}));

// Mock nativewind/preset (needed for tailwind config import)
vi.mock("nativewind/preset", () => ({ default: {} }));

// Mock expo-haptics
vi.mock("expo-haptics", () => ({
  impactAsync: createMock(),
  notificationAsync: createMock(),
  selectionAsync: createMock(),
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
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useSharedValue: (init: unknown) => ({ value: init }),
    withTiming: <T>(val: T) => val,
    withRepeat: <T>(val: T) => val,
    withSequence: <T>(...vals: T[]) => vals[0],
    cancelAnimation: createMock(),
    runOnJS: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

// Mock expo-sqlite
vi.mock("expo-sqlite", () => ({
  openDatabaseSync: createMock(() => ({ execSync: createMock(), closeSync: createMock() })),
  deleteDatabaseAsync: createMock(() => Promise.resolve()),
}));

// Note: date-fns is NOT mocked globally. Tests that need deterministic date
// behavior should mock it at the file level with vi.mock or vi.doMock.

// Mock expo-router
export const mockReplace = createMock();
export const mockPush = createMock();
export const mockBack = createMock();

vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
}));

// Mock vector icon packages
vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: "Ionicons",
}));

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => ({
  createClient: createMock(() => ({
    auth: {
      getSession: createMock(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: createMock(() => ({
        data: { subscription: { unsubscribe: createMock() } },
      })),
      signInWithOAuth: createMock(),
      signOut: createMock(),
    },
    from: createMock(() => ({
      select: createMock(() => ({ data: [], error: null })),
      upsert: createMock(() => ({ error: null })),
      delete: createMock(() => ({ error: null })),
    })),
  })),
}));

// Mock expo-secure-store
vi.mock("expo-secure-store", () => ({
  getItemAsync: createMock(() => Promise.resolve(null)),
  setItemAsync: createMock(() => Promise.resolve()),
  deleteItemAsync: createMock(() => Promise.resolve()),
  getItem: createMock(),
  setItem: createMock(),
}));

// Mock expo-crypto
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: createMock(() => Promise.resolve(new Uint8Array(32))),
  getRandomBytes: createMock(() => new Uint8Array(32)),
}));

// Mock Expo UI DateTimePicker drop-in
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
}));

// Mock @react-native-community/netinfo
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: createMock(() => createMock()),
    fetch: createMock(() => Promise.resolve({ isConnected: true })),
  },
}));

// Mock expo-web-browser
vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: createMock(() => Promise.resolve({ type: "dismiss" })),
  maybeCompleteAuthSession: createMock(),
  openBrowserAsync: createMock(),
}));

// Mock @sentry/react-native
vi.mock("@sentry/react-native", () => ({
  init: createMock(),
  captureException: createMock(),
  captureMessage: createMock(),
  setUser: createMock(),
  withScope: createMock<[cb: (scope: unknown) => void], void>((cb) =>
    cb({ setContext: createMock(), setLevel: createMock() })
  ),
  ErrorBoundary: "SentryErrorBoundary",
  wrap: createMock<[component: unknown], unknown>((component) => component),
}));

// Mock burnt
vi.mock("burnt", () => ({
  toast: createMock(),
}));

// Mock expo-updates
vi.mock("expo-updates", () => ({
  reloadAsync: createMock(),
}));

// Mock expo-background-task
vi.mock("expo-background-task", () => ({
  registerTaskAsync: createMock(),
  unregisterTaskAsync: createMock(),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));

// Mock expo-task-manager
vi.mock("expo-task-manager", () => ({
  defineTask: createMock(),
  isTaskRegisteredAsync: createMock<[], Promise<boolean>>().mockResolvedValue(false),
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
  addListener: createMock(() => ({ remove: createMock() })),
  setAllowedPackages: createMock(),
  isPermissionGranted: createMock(() => Promise.resolve(false)),
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
  scheduleNotificationAsync: createMock(),
  cancelScheduledNotificationAsync: createMock(),
  getAllScheduledNotificationsAsync: createMock(() => Promise.resolve([])),
  SchedulableTriggerInputTypes: { WEEKLY: "weekly" },
  getPermissionsAsync: createMock(() =>
    Promise.resolve({ status: "undetermined", granted: false, canAskAgain: true })
  ),
  requestPermissionsAsync: createMock(() =>
    Promise.resolve({ status: "granted", granted: true, canAskAgain: true })
  ),
  setNotificationHandler: createMock(),
  getExpoPushTokenAsync: createMock(() => Promise.resolve({ data: "ExponentPushToken[mock]" })),
  addPushTokenListener: createMock(() => ({ remove: createMock() })),
  addNotificationResponseReceivedListener: createMock(() => ({ remove: createMock() })),
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
  requireNativeModule: createMock(() => ({
    isAvailable: createMock(() => false),
    addListener: createMock(() => ({ remove: createMock() })),
  })),
}));

// Mock posthog-react-native (native module, not transformable in Vitest node env)
vi.mock("posthog-react-native", () => ({
  default: class {
    identify = createMock();
    capture = createMock();
    reset = createMock();
  },
}));
