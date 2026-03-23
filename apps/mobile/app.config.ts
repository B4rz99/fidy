import type { ExpoConfig } from "expo/config";

// Cast: newArchEnabled, edgeToEdgeEnabled, predictiveBackGestureEnabled
// exist in SDK 55 but @expo/config-types hasn't caught up yet.
const config: ExpoConfig & { newArchEnabled?: boolean } = {
  name: "Fidy",
  slug: "Fidy",
  version: "0.0.1",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "fidy",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.obarbozaa.Fidy",
    infoPlist: {
      // biome-ignore lint/style/useNamingConvention: Apple plist key
      CFBundleURLTypes: [
        {
          // biome-ignore lint/style/useNamingConvention: Apple plist key
          CFBundleURLSchemes: [
            "com.googleusercontent.apps.282682681790-630ti7lmdsjcm32o31m1kq50q20727pn",
          ],
        },
      ],
    },
  },
  android: {
    package: "com.obarbozaa.fidy",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // SDK 55 properties not yet in @expo/config-types
    ...({ edgeToEdgeEnabled: true, predictiveBackGestureEnabled: false } as Record<
      string,
      unknown
    >),
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    // biome-ignore lint/style/useNamingConvention: expo-sqlite config key
    ["expo-sqlite", { useSQLCipher: true }],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#000000" },
      },
    ],
    "expo-background-task",
    "expo-localization",
    "expo-notifications",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "78256cac-010c-40e8-a651-4cc4b6000e41",
    },
  },
  owner: "obarbozaa",
};

export default config;
