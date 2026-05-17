/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "packages-must-not-depend-on-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "shared-must-not-depend-on-app-routes",
      severity: "error",
      from: { path: "^apps/mobile/shared/" },
      to: { path: "^apps/mobile/app/" },
    },
    {
      name: "shared-must-not-depend-on-features",
      severity: "error",
      from: { path: "^apps/mobile/shared/" },
      to: { path: "^apps/mobile/features/" },
    },
    {
      name: "shared-must-not-depend-on-modules",
      severity: "error",
      from: { path: "^apps/mobile/shared/" },
      to: { path: "^apps/mobile/modules/" },
    },
    {
      name: "shared-must-not-depend-on-local-ledger",
      severity: "error",
      from: { path: "^apps/mobile/shared/" },
      to: { path: "^apps/mobile/local-ledger/" },
    },
    {
      name: "app-routes-must-not-be-imported-from-outside-app",
      severity: "error",
      from: { pathNot: "^apps/mobile/app/" },
      to: { path: "^apps/mobile/app/" },
    },
    {
      name: "modules-must-not-depend-on-app-features-or-shared",
      severity: "error",
      from: { path: "^apps/mobile/modules/" },
      to: { path: "^apps/mobile/(app|features|shared)/" },
    },
    {
      name: "mutations-must-not-depend-on-app-routes-or-native-modules",
      severity: "error",
      from: { path: "^apps/mobile/mutations/" },
      to: { path: "^apps/mobile/(app|modules)/" },
    },
    {
      name: "local-ledger-must-not-import-app-runtime-internals",
      severity: "error",
      from: { path: "^apps/mobile/local-ledger/" },
      to: {
        path: "^apps/mobile/features/|^apps/mobile/app/|^apps/mobile/modules/|^apps/mobile/shared/db($|/)|^apps/mobile/infrastructure/|^apps/mobile/shared/(query|effect|components)($|/)|^apps/mobile/shared/lib($|\\.public\\.ts|/index\\.ts)|^apps/mobile/shared/lib/(analytics|sentry|toast)\\.ts",
      },
    },
    {
      name: "local-ledger-must-not-import-runtime-packages",
      severity: "error",
      from: { path: "^apps/mobile/local-ledger/" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer"],
        path: "^(node_modules/)?(drizzle-orm|react|react-native|expo|expo-[^/]+|@expo/|zustand|@supabase/|@sentry/)",
      },
    },
    {
      name: "local-ledger-consumers-must-use-public-entrypoints",
      severity: "error",
      from: {
        pathNot: "^apps/mobile/(local-ledger/|infrastructure/local-ledger/|__tests__/)",
      },
      to: {
        path: "^apps/mobile/local-ledger/",
        pathNot: "^apps/mobile/local-ledger/(public|snapshot\\.public|intake\\.public)\\.ts$",
      },
    },
    {
      name: "local-ledger-infrastructure-must-not-import-features",
      severity: "error",
      from: { path: "^apps/mobile/infrastructure/local-ledger/" },
      to: { path: "^apps/mobile/features/" },
    },
    {
      name: "local-ledger-infrastructure-must-not-import-ui-or-app-runtime",
      severity: "error",
      from: { path: "^apps/mobile/infrastructure/local-ledger/" },
      to: {
        path: "^apps/mobile/app/|^apps/mobile/modules/|^apps/mobile/shared/(components|hooks|query)($|/)|^apps/mobile/shared/lib(/index)?\\.ts|^apps/mobile/shared/lib/(analytics|sentry|toast)\\.ts",
      },
    },
    {
      name: "only-app-or-features-may-depend-on-mutations",
      severity: "error",
      from: { pathNot: "^apps/mobile/(app/.+|features/.+)" },
      to: { path: "^apps/mobile/mutations/" },
    },
  ],
  options: {
    includeOnly:
      "^((apps/mobile)|(packages)|node_modules/(drizzle-orm|react|react-native|expo|expo-[^/]+|@expo/|zustand|@supabase/|@sentry/))",
    doNotFollow: {
      path: ["node_modules", "\\.expo", "\\.worktrees", "dist", "coverage"],
    },
    tsConfig: {
      fileName: "tsconfig.depcruise.json",
    },
  },
};
