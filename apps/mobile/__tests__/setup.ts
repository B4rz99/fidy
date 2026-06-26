// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { vi } from "vitest";

type MockImplementation<TArgs extends readonly unknown[] = [], TReturn = void> = (
  ...args: TArgs
) => TReturn;

const { createMock, expoCryptoAesMock } = vi.hoisted(() => {
  const createMock = <TArgs extends readonly unknown[] = [], TReturn = void>(
    implementation?: MockImplementation<TArgs, TReturn>
  ) => vi.fn<MockImplementation<TArgs, TReturn>>(implementation);

  const toBytes = (input: string | Uint8Array | ArrayBuffer): Uint8Array => {
    if (typeof input === "string") {
      return Uint8Array.from(Buffer.from(input, "base64"));
    }
    if (input instanceof ArrayBuffer) {
      return new Uint8Array(input);
    }
    return input;
  };
  const toBase64 = (input: Uint8Array): string => Buffer.from(input).toString("base64");
  const concatBytes = (left: Uint8Array, right: Uint8Array): Uint8Array => {
    const combined = new Uint8Array(left.byteLength + right.byteLength);
    combined.set(left);
    combined.set(right, left.byteLength);
    return combined;
  };
  const xorWithKeyAndNonce = (bytes: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array =>
    Uint8Array.from(
      bytes,
      (byte, index) =>
        byte ^ (key[index % key.byteLength] ?? 0) ^ (nonce[index % nonce.byteLength] ?? 0)
    );

  class MockAESEncryptionKey {
    private constructor(readonly keyBytes: Uint8Array) {}

    static import(input: Uint8Array): Promise<MockAESEncryptionKey> {
      return Promise.resolve(new MockAESEncryptionKey(input.slice()));
    }
  }

  class MockAESSealedData {
    private constructor(
      readonly nonce: Uint8Array,
      readonly ciphertextWithTag: Uint8Array,
      readonly tagLength: number
    ) {}

    static fromParts(
      nonce: string | Uint8Array | ArrayBuffer,
      ciphertext: string | Uint8Array | ArrayBuffer,
      tag?: string | Uint8Array | ArrayBuffer | number
    ): MockAESSealedData {
      const tagLength =
        typeof tag === "number" || tag === undefined ? (tag ?? 16) : toBytes(tag).byteLength;
      const ciphertextWithTag =
        typeof tag === "number" || tag === undefined
          ? toBytes(ciphertext)
          : concatBytes(toBytes(ciphertext), toBytes(tag));
      return new MockAESSealedData(toBytes(nonce), ciphertextWithTag, tagLength);
    }

    ciphertext(
      options: { readonly includeTag?: boolean; readonly encoding?: "base64" | "bytes" } = {}
    ) {
      const bodyLength = Math.max(0, this.ciphertextWithTag.byteLength - this.tagLength);
      const bytes = options.includeTag
        ? this.ciphertextWithTag
        : this.ciphertextWithTag.slice(0, bodyLength);
      return Promise.resolve(options.encoding === "base64" ? toBase64(bytes) : bytes);
    }

    iv(encoding?: "base64" | "bytes") {
      return Promise.resolve(encoding === "base64" ? toBase64(this.nonce) : this.nonce);
    }
  }

  const aesEncryptAsync = createMock(
    (
      plaintext: string | Uint8Array | ArrayBuffer,
      key: MockAESEncryptionKey,
      options: {
        readonly nonce?: { readonly bytes?: string | Uint8Array | ArrayBuffer };
        readonly tagLength?: number;
      } = {}
    ) => {
      const nonce = options.nonce?.bytes ? toBytes(options.nonce.bytes) : new Uint8Array(12);
      const ciphertext = xorWithKeyAndNonce(toBytes(plaintext), key.keyBytes, nonce);
      const tag = new Uint8Array(options.tagLength ?? 16).fill(7);
      return Promise.resolve(
        MockAESSealedData.fromParts(nonce, concatBytes(ciphertext, tag), tag.byteLength)
      );
    }
  );
  const aesDecryptAsync = createMock((sealedData: MockAESSealedData, key: MockAESEncryptionKey) => {
    const bodyLength = Math.max(0, sealedData.ciphertextWithTag.byteLength - sealedData.tagLength);
    const ciphertext = sealedData.ciphertextWithTag.slice(0, bodyLength);
    return Promise.resolve(xorWithKeyAndNonce(ciphertext, key.keyBytes, sealedData.nonce));
  });

  return {
    createMock,
    expoCryptoAesMock: {
      AESEncryptionKey: MockAESEncryptionKey,
      AESSealedData: MockAESSealedData,
      aesDecryptAsync,
      aesEncryptAsync,
    },
  };
});

process.env.EXPO_PUBLIC_GMAIL_CLIENT_ID = "test-gmail-client-id.apps.googleusercontent.com";
process.env.EXPO_PUBLIC_OUTLOOK_CLIENT_ID = "test-outlook-client-id";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("react-native", () => import("./helpers/react-native-mock"));
vi.mock("@/shared/components/rn", () => import("./helpers/react-native-mock"));

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

// Mock react-native-safe-area-context
vi.mock("react-native-safe-area-context", () => safeAreaContextMock);

// Mock lucide-react-native
vi.mock("lucide-react-native", () => lucideReactNativeMock);

// Mock expo-image native component
vi.mock("expo-image", () => ({ Image: "Image" }));

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
  router: { replace: mockReplace, push: mockPush, back: mockBack },
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
  Stack: {
    Screen: "Stack.Screen",
  },
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
  ...expoCryptoAesMock,
  AESKeySize: { AES128: 128, AES192: 192, AES256: 256 },
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: createMock(() => Promise.resolve(new Uint8Array(32))),
  getRandomBytes: createMock((byteCount: number) =>
    Uint8Array.from({ length: byteCount }, (_, index) => index + 1)
  ),
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
  Filter: "Filter",
  FeGaussianBlur: "FeGaussianBlur",
  G: "G",
  Text: "SvgText",
  Line: "Line",
  Polyline: "Polyline",
  Defs: "Defs",
  LinearGradient: "LinearGradient",
  RadialGradient: "RadialGradient",
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
