// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const tseslint = require("typescript-eslint");

// __dirname is available here because this file is CommonJS (require/module.exports)
// eslint-disable-next-line no-undef
const rootDir = __dirname;

// Shared barrel-import restriction patterns used across multiple config layers
const BARREL_PATTERNS = [
  { group: ["@/features/*/lib/*"], message: "Import from @/features/<name> barrel instead" },
  { group: ["@/features/*/components/*"], message: "Import from @/features/<name> barrel instead" },
  { group: ["@/features/*/hooks/*"], message: "Import from @/features/<name> barrel instead" },
  { group: ["@/features/*/store"], message: "Import from @/features/<name> barrel instead" },
  { group: ["@/features/*/schema"], message: "Import from @/features/<name> barrel instead" },
  { group: ["@/features/*/services/*"], message: "Import from @/features/<name> barrel instead" },
  { group: ["@/shared/lib/*"], message: "Import from @/shared/lib barrel instead" },
  { group: ["@/shared/db/*"], message: "Import from @/shared/db barrel instead" },
  {
    group: ["@/shared/components/*", "!@/shared/components/rn", "!@/shared/components/icons"],
    message:
      "Import from @/shared/components barrel, @/shared/components/rn, or @/shared/components/icons instead",
  },
  // "react-native" pattern also matches @sentry/react-native — exclude it
  { group: ["react-native", "!@sentry/*"], message: "Import from @/shared/components/rn instead" },
  { group: ["lucide-react-native"], message: "Import from @/shared/components/icons instead" },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },

  // ── Type-aware parser setup ──────────────────────────────────────────
  // Note: @typescript-eslint plugin is already registered by eslint-config-expo.
  // We only need to configure the parser and parserOptions here.
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
  },

  // ── Strict rules (all TS files) ─────────────────────────────────────
  // Rules start as "warn" so this PR can land before auto-fixes.
  // A follow-up PR upgrades all "warn" → "error" after fixes are merged.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // — Type-aware rules (highest value) —
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/switch-exhaustiveness-check": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",

      // — Syntax-only rules —
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // — FP-mandate rules (align with CLAUDE.md) —
      "no-param-reassign": "warn",
      "prefer-const": "warn",
      "no-var": "error",

      // — React rules —
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // ── useEffect / useLayoutEffect ban (feature code only) ─────────────
  // Allowed ONLY in shared/hooks/** (where approved wrappers live)
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["shared/hooks/**", "__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "react",
              importNames: ["useEffect", "useLayoutEffect"],
              message:
                "useEffect/useLayoutEffect are banned. Use approved hooks from @/shared/hooks instead (useMountEffect, useSubscription, useBlinkingCursor, useAnimatedProgress).",
            },
          ],
          patterns: [
            ...BARREL_PATTERNS,
            {
              group: ["@/shared/hooks/*"],
              message: "Import from @/shared/hooks barrel instead",
            },
          ],
        },
      ],
    },
  },

  // ── Barrel import restrictions for shared/hooks/** ──────────────────
  // Exempt from the useEffect ban but still need barrel restrictions
  {
    files: ["shared/hooks/**/*.ts", "shared/hooks/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["warn", { patterns: BARREL_PATTERNS }],
    },
  },

  // ── Exemptions for rn.ts, icons.ts, and native modules ──────────────
  {
    files: ["shared/components/rn.ts", "shared/components/icons.ts", "modules/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  // ── Test file overrides ─────────────────────────────────────────────
  {
    files: ["__tests__/**/*.ts", "__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "no-restricted-imports": "off",
    },
  },
]);
