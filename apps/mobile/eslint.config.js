// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "__tests__/**",
      "shared/components/rn.ts",
      "shared/components/icons.ts",
      "modules/**",
      "app/_layout.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/lib/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/components/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/hooks/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/store"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/schema"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/services/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/shared/lib/*"],
              message: "Import from @/shared/lib barrel instead",
            },
            {
              group: ["@/shared/hooks/*"],
              message: "Import from @/shared/hooks barrel instead",
            },
            {
              group: ["@/shared/db/*"],
              message: "Import from @/shared/db barrel instead",
            },
            {
              group: [
                "@/shared/components/*",
                "!@/shared/components/rn",
                "!@/shared/components/icons",
              ],
              message:
                "Import from @/shared/components barrel, @/shared/components/rn, or @/shared/components/icons instead",
            },
            {
              // "react-native" pattern also matches @sentry/react-native — exclude it
              group: ["react-native", "!@sentry/*"],
              message: "Import from @/shared/components/rn instead",
            },
            {
              group: ["lucide-react-native"],
              message: "Import from @/shared/components/icons instead",
            },
          ],
        },
      ],
    },
  },
]);
