import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: false,
    clearMocks: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.ts"],
    server: {
      deps: {
        external: [
          /react-native/,
          /react-native-safe-area-context/,
          /react-native-svg/,
          /@react-navigation/,
        ],
      },
    },
    coverage: {
      provider: "v8",
      include: [
        "features/**/lib/**",
        "features/**/data/**",
        "features/transactions/schema.ts",
        "features/transactions/store.ts",
        "features/ai-chat/schema.ts",
        "features/ai-chat/lib/**",
        "features/calendar/schema.ts",
        "features/calendar/store.ts",
        "features/menu/store.ts",
        "shared/constants/theme.ts",
        "shared/hooks/use-theme-color.ts",
        "shared/components/navigation/tab-config.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
