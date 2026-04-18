// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const boundaries = require("eslint-plugin-boundaries");
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

  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    rules: {
      "prefer-object-spread": "error",
    },
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
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      boundaries,
    },
    rules: {
      // — Type-aware rules (highest value) —
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",

      // — Syntax-only rules —
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "object-shorthand": ["error", "always"],
      "no-constant-binary-expression": "error",
      "no-self-compare": "error",
      "no-useless-catch": "error",
      "array-callback-return": "error",
      "no-console": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      yoda: "error",
      "no-implicit-coercion": "error",
      curly: ["error", "multi-line"],
      radix: "error",
      "default-case-last": "error",
      "no-fallthrough": "error",
      "no-implied-eval": "error",
      "no-else-return": "error",
      "no-useless-return": "error",
      "no-lonely-if": "error",
      "no-unneeded-ternary": "error",
      "no-nested-ternary": "error",
      "prefer-object-has-own": "error",

      // — FP-mandate rules (align with CLAUDE.md) —
      "no-param-reassign": "error",
      "prefer-const": "error",
      "no-var": "error",

      // — React rules —
      "react-hooks/exhaustive-deps": "error",

      // — Import rules —
      "import/no-cycle": "error",
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: ["feature-public", "feature-internal"],
              disallow: ["app"],
            },
            {
              from: "shared",
              disallow: ["app", "feature-public", "feature-internal", "module"],
            },
            {
              from: "module",
              disallow: ["app", "feature-public", "feature-internal", "shared"],
            },
            {
              from: "app",
              disallow: ["feature-internal"],
            },
          ],
        },
      ],
      "import/first": "error",
      "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    },
  },

  // ── Pure module FP guardrails (lib/schema/utils only) ───────────────
  {
    files: [
      "features/**/lib/**/*.ts",
      "features/**/lib/**/*.tsx",
      "shared/lib/**/*.ts",
      "shared/lib/**/*.tsx",
      "features/**/schema.ts",
      "features/**/schema/**/*.ts",
      "features/**/utils/**/*.ts",
      "features/**/utils/**/*.tsx",
      "shared/utils/**/*.ts",
      "shared/utils/**/*.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ForStatement, ForInStatement, ForOfStatement, WhileStatement, DoWhileStatement",
          message:
            "Pure modules in lib/schema/utils must stay declarative. Use map/filter/reduce or recursion instead of imperative loops.",
        },
      ],
    },
  },

  // ── useEffect / useLayoutEffect ban (feature code only) ─────────────
  // Allowed ONLY in shared/hooks/** (where approved wrappers live)
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["shared/hooks/**", "__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
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
      "no-restricted-imports": ["error", { patterns: BARREL_PATTERNS }],
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
