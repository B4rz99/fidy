# Dependency Upgrade Audit Plan

## Purpose

Upgrade dependencies without blind version bumps. Each upgrade must first answer what the package is used for, what changed upstream, what code paths are affected, and which verification proves the app still works.

## Current State

- Package manager: Bun `1.3.10`.
- Main app: Expo SDK 55, React `19.2.0`, React Native `0.83.4`, new architecture enabled.
- Dependency policy currently reports 44 violations with a 30-day stale-upstream threshold.
- Many violations are not upgradeable because the package has no newer stable version; those need an allowlist, replacement decision, or policy change rather than a version bump.
- Expo-managed native packages must be checked against Expo SDK compatibility before using npm latest.

## Definition Of Clean Upgrade

For every dependency or dependency cluster, complete this before merging:

1. Record current version, target version, and reason for upgrade.
2. Read upstream release notes/changelog between current and target.
3. Search local imports and config usage.
4. Identify runtime surfaces affected: startup, navigation, persistence, auth, sync, notifications, backup, charts, animation, forms, or build tooling.
5. Prefer the smallest compatible target version, not necessarily npm latest.
6. Use package-specific migration steps when provided.
7. Run automated checks.
8. Run targeted manual QA for affected mobile flows.
9. Keep each PR focused enough that failures can be attributed to one package or one compatibility cluster.

## Mandatory Checks

Run after each upgrade PR unless the PR explicitly documents why a check is irrelevant:

- `bun install`
- `bun run lint`
- `bun run lint:brands`
- `bun run lint:mobile`
- `bun run lint:architecture`
- `bun run typecheck`
- `bun run test`
- `bun run lint:dependency-policy`
- For native/runtime clusters: `bun run qa:ios` or the mobile QA workflow on the iPhone simulator.

## Upgrade Order

### Phase 0: Policy Calibration

Goal: separate real upgrade debt from stale-but-current packages.

Tasks:

- Add or design a policy allowlist for packages whose latest stable release is older than 30 days but still intentional.
- Decide whether the 30-day stale-upstream rule should block CI for all packages or only for packages with known viable alternatives.
- Re-run dependency policy after every phase and update the ledger.

Packages currently likely in this category:

- `@babel/plugin-transform-react-jsx`
- `@expo-google-fonts/poppins`
- `@expo/vector-icons`
- `@types/better-sqlite3`
- `@types/react`
- `babel-plugin-inline-import`
- `burnt`
- `date-fns`
- `dependency-cruiser`
- `drizzle-orm`
- `eslint-config-expo`
- `eslint-plugin-boundaries`
- `eslint-plugin-import`
- `expo-android-notification-listener-service`
- `expo-atlas`
- `i18n-js`
- `nativewind`
- `react-native-css-interop`
- `react-native-svg`
- `react-native-web`
- `xcodebuildmcp`
- `zustand`

### Phase 1: Low-Risk Tooling Patches

Goal: update tooling with minimal app runtime impact.

Candidate packages:

- `@biomejs/biome`
- `bun-types`
- `lefthook`
- `knip`
- `@vitest/coverage-v8`
- `vitest`
- `@stryker-mutator/core`
- `effect`
- `drizzle-kit`
- `better-sqlite3`

Inspection focus:

- CLI flags and config compatibility.
- TypeScript parser behavior.
- Vitest setup and mocks.
- Drizzle migration generation behavior.
- Native sqlite build compatibility on local machine and CI.

Verification focus:

- Full root verification.
- `bun run test:mobile`.
- `bun run --cwd apps/mobile --shell=bun test:mutation` only if Stryker changes.
- Generate a no-op Drizzle check if Drizzle tooling changes.

### Phase 2: Expo SDK Patch Alignment

Goal: bring Expo SDK 55 packages to their compatible patch versions before touching React Native major/minor packages.

Candidate packages:

- `expo`
- `expo-background-task`
- `expo-constants`
- `expo-dev-client`
- `expo-image`
- `expo-linking`
- `expo-notifications`
- `expo-router`
- `expo-splash-screen`
- `expo-system-ui`
- `expo-task-manager`
- `expo-updates`
- `babel-preset-expo`

Inspection focus:

- `apps/mobile/app.config.ts` and `apps/mobile/app.json` plugin drift.
- Expo Router typed routes.
- React Compiler experiment compatibility.
- Dev client launch behavior.
- Notification plugin config and local notification scheduling.
- SQLite SQLCipher plugin behavior.

Verification focus:

- `npx expo install --check` or Expo Doctor equivalent from `apps/mobile`.
- iOS dev-client build/run.
- Smoke test startup, routing, SQLite startup, notification registration, and backup screen.

### Phase 3: Pure Runtime Libraries

Goal: update app libraries that should not require native rebuilds or Expo SDK coordination.

Candidate packages:

- `@supabase/supabase-js`
- `@tanstack/react-query`
- `posthog-react-native`
- `zod`
- `date-fns`
- `i18n-js`
- `zustand`

Inspection focus:

- Auth session types and Supabase client initialization.
- Backup remote storage and Edge Function callers.
- Query invalidation, retries, focus manager, and mutation behavior.
- Zod parser output and error shape changes.
- Date formatting and locale behavior.
- Zustand store middleware/API compatibility.
- Analytics client initialization and event capture.

Verification focus:

- Deep tests around schemas, stores, query services, backup, auth, onboarding, notifications, and date derivations.
- Manual smoke: login/session restore, local-first data load, backup flow, AI chat query, notification preferences.

### Phase 4: UI And Component Libraries

Goal: update UI dependencies with focused visual and interaction QA.

Candidate packages:

- `@shopify/flash-list`
- `lucide-react-native`
- `react-native-svg`
- `@expo/vector-icons`
- `@expo-google-fonts/poppins`
- `burnt`

Inspection focus:

- List ref types and estimated item sizing.
- Icon export names and changed glyph rendering.
- SVG chart rendering and progress rings.
- Toast API and visual behavior.
- Font loading behavior and fallback rendering.

Verification focus:

- Manual QA on dashboard charts, review queues, AI chat list, transaction lists, goal detail, toasts, empty states, and icon-heavy screens.
- Screenshot comparison where visual regressions are likely.

### Phase 5: Native React Native Libraries

Goal: update native modules only after Expo SDK alignment is stable.

Candidate packages:

- `@react-native-community/datetimepicker`
- `@react-native-community/netinfo`
- `react-native-gesture-handler`
- `react-native-reanimated`
- `react-native-worklets`
- `react-native-safe-area-context`
- `react-native-screens`
- `react-native-svg`

Inspection focus:

- Expo SDK compatibility matrix.
- iOS Pod changes and Android Gradle changes.
- New architecture support.
- Date picker event signatures and display modes.
- NetInfo listener behavior.
- Reanimated/worklets Babel/plugin requirements.
- Navigation gesture/screen lifecycle behavior.

Verification focus:

- Clean native rebuild.
- App startup and route transitions.
- Add/edit transaction, bill, goal, transfer, and financial account date fields.
- Offline/online transition behavior.
- Animation-heavy screens and gesture navigation.

### Phase 6: Framework Majors And Breaking Changes

Goal: handle changes that can alter project-wide behavior.

Candidate packages:

- `react-native` `0.83.4 -> 0.85.x`
- `@sentry/react-native` `7.x -> 8.x`
- `@react-native-community/datetimepicker` `8.x -> 9.x`
- `@react-native-community/netinfo` `11.x -> 12.x`
- `eslint` `9.x -> 10.x`
- `tailwindcss` `3.x -> 4.x`
- `lucide-react-native` `0.x -> 1.x`

Inspection focus:

- Upgrade guides and codemods.
- Expo SDK support; do not upgrade React Native beyond what SDK 55 supports unless planning an Expo SDK upgrade too.
- Sentry Expo plugin and source map upload config.
- ESLint flat config and Expo lint compatibility.
- Tailwind v4/nativewind compatibility; do not upgrade Tailwind if NativeWind remains tied to v3 semantics.
- Icon name/API changes and tree-shaking behavior.

Verification focus:

- Separate PR per major unless two packages must move together.
- Full automated verification.
- Native iOS QA.
- Release-build smoke when Sentry, React Native, Expo, or Tailwind changes.

## Per-Package Impact Template

Use this template in each PR description or a dependency ledger entry:

```md
## Dependency

- Package:
- Current:
- Target:
- Update type: patch | minor | major | stale-upstream decision
- Why now:

## Upstream Changes Reviewed

- Changelog/release notes:
- Breaking changes:
- Peer dependency changes:
- Native/build changes:

## Local Usage

- Import/config locations:
- Affected features:
- Risk level: low | medium | high

## Code Changes Needed

- Required code changes:
- Config changes:
- Migration/codemod:

## Verification

- Automated checks:
- Manual QA:
- Known residual risk:
```

## Dependency Impact Ledger

This ledger is the working audit record. Targets come from `bun outdated`, npm metadata, and Expo SDK 55 compatibility checks run from `apps/mobile`. Changelog sources are listed so each upgrade PR can link the exact release range it used.

### Expo SDK 55 Compatibility Result

`bunx expo install --check` currently reports these expected SDK-compatible versions:

- `expo`: `55.0.15 -> ~55.0.19`
- `expo-background-task`: `55.0.16 -> ~55.0.17`
- `expo-constants`: `55.0.14 -> ~55.0.15`
- `expo-dev-client`: `55.0.27 -> ~55.0.30`
- `expo-image`: `55.0.8 -> ~55.0.9`
- `expo-linking`: `55.0.13 -> ~55.0.14`
- `expo-notifications`: `55.0.19 -> ~55.0.22`
- `expo-router`: `55.0.12 -> ~55.0.13`
- `expo-splash-screen`: `55.0.18 -> ~55.0.19`
- `expo-system-ui`: `55.0.15 -> ~55.0.16`
- `expo-task-manager`: `55.0.14 -> ~55.0.15`
- `expo-updates`: `55.0.20 -> ~55.0.21`
- `react-native`: `0.83.4 -> 0.83.6`
- `react-native-worklets`: `0.7.2 -> 0.7.4`

Do not use npm latest for Expo-managed native packages until an Expo SDK upgrade is explicitly planned.

### Real Upgrade Candidates

| Package | Current | Target | Peer constraints checked | Release notes reviewed/source | Local usage and expected codebase impact | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `expo` | `55.0.15` | `~55.0.19` | peers `react`, `react-native`; Expo SDK check expects `~55.0.19` | Expo package releases: `https://github.com/expo/expo/releases` | Central runtime; touches app startup, config plugins, router, Metro, native modules. No direct app code expected for patch, but rerun Expo check and simulator smoke. | Upgrade in Expo patch PR. |
| `expo-background-task` | `55.0.16` | `~55.0.17` | peers `expo`; SDK check expects `~55.0.17` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/background-task/` | Used by notification/calendar background workflows through Expo task system. Patch should not require code changes; verify background task registration. | Upgrade in Expo patch PR. |
| `expo-constants` | `55.0.14` | `~55.0.15` | peers `expo`, `react-native`; SDK check expects `~55.0.15` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/constants/` | Config/constants access risk; verify app config reads and startup. | Upgrade in Expo patch PR. |
| `expo-dev-client` | `55.0.27` | `~55.0.30` | peers `expo`; SDK check expects `~55.0.30` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/dev-client/` | Dev-client build/runtime only. Check `app.config.ts` launch mode and local QA startup. | Upgrade in Expo patch PR. |
| `expo-image` | `55.0.8` | `~55.0.9` | peers `expo`, `react`, `react-native`, `react-native-web`; SDK check expects `~55.0.9` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/image/` | Low direct usage from package scan; verify screens with images/assets. | Upgrade in Expo patch PR. |
| `expo-linking` | `55.0.13` | `~55.0.14` | peers `react`, `react-native`; SDK check expects `~55.0.14`; `expo-router` target peers on `expo-linking ^55.0.14` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/linking/` | Deep-link handling and notification routing. Keep notification deep-link builders/readers in sync. | Upgrade with `expo-router`. |
| `expo-notifications` | `55.0.19` | `~55.0.22` | peers `expo`, `react`, `react-native`; SDK check expects `~55.0.22` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/notifications/` | Direct notification scheduling/listener risk. Verify preferences, scheduled reminders, deep-link opening. | Upgrade in Expo patch PR with manual notification QA. |
| `expo-router` | `55.0.12` | `~55.0.13` | peers include `expo-linking ^55.0.14`, `expo-constants ^55.0.15`, `@expo/metro-runtime ^55.0.10`, `react-native-screens`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context >=5.4.0` | Expo Router releases/docs: `https://docs.expo.dev/routing/introduction/` | Route generation, typed routes, app startup. Re-run typecheck and route smoke. | Upgrade with Expo patch PR. |
| `expo-splash-screen` | `55.0.18` | `~55.0.19` | peers `expo`; SDK check expects `~55.0.19` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/splash-screen/` | Config plugin in `app.config.ts`; verify splash on cold start. | Upgrade in Expo patch PR. |
| `expo-system-ui` | `55.0.15` | `~55.0.16` | peers `expo`, `react-native`, `react-native-web`; SDK check expects `~55.0.16` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/system-ui/` | System UI colors/theme risk; verify light/dark startup. | Upgrade in Expo patch PR. |
| `expo-task-manager` | `55.0.14` | `~55.0.15` | peers `expo`, `react-native`; SDK check expects `~55.0.15` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/task-manager/` | Background task dependency; verify task registration. | Upgrade with background-task. |
| `expo-updates` | `55.0.20` | `~55.0.21` | peers `expo`, `react`, `react-native`; SDK check expects `~55.0.21` | Expo releases/docs: `https://docs.expo.dev/versions/latest/sdk/updates/` | OTA/update runtime only. Verify release build config before production. | Upgrade in Expo patch PR. |
| `babel-preset-expo` | `55.0.17` resolved | `55.0.19` | peers `expo`, optional `expo-widgets`, `react-refresh`, `@babel/runtime` | Expo releases: `https://github.com/expo/expo/releases` | Babel transform risk; React Compiler experiment is enabled. Run tests and typecheck. | Upgrade with Expo patch PR. |
| `react-native` | `0.83.4` | `0.83.6` for SDK 55; defer `0.85.2` | npm latest peers `react ^19.2.3`, `@types/react ^19.1.1`; npm latest engine `node ^20.19.4 || ^22.13.0 || ^24.3.0 || >=25`; Expo SDK check expects only `0.83.6` | RN releases: `https://github.com/facebook/react-native/releases`; npm metadata checked | Native runtime, app startup, new architecture. Do not jump to `0.85.x` under SDK 55. `0.83.6` patch should be native rebuild plus smoke. | Upgrade only to Expo-compatible `0.83.6`; defer latest. |
| `react-native-worklets` | `0.7.2` | `0.7.4` for SDK 55; defer `0.8.1` | npm latest `0.8.1` peers `react-native 0.81 - 0.85`, `@babel/core`, `@react-native/metro-config`; Reanimated `4.3.0` requires `0.8.x` | Reanimated/worklets docs: `https://docs.swmansion.com/react-native-worklets` | Animation compiler/runtime. Under SDK 55, use Expo expected `0.7.4`; do not move to `0.8.x` unless Reanimated moves too. | Upgrade to `0.7.4`; defer `0.8.x`. |
| `@react-navigation/native` | `7.1.33` | `7.2.2` | peers `react >=18.2.0`, `react-native *`; child packages target `^7.2.2` | React Navigation releases: `https://github.com/react-navigation/react-navigation/releases` | Navigation container/linking behavior; local usage in app layout and nav components. Expected code changes low, but route/deep-link smoke required. | Upgrade with nav cluster. |
| `@react-navigation/bottom-tabs` | `7.15.5` resolved | `7.15.11` | peers `@react-navigation/native ^7.2.2`, `react-native-safe-area-context >=4`, `react-native-screens >=4` | React Navigation releases: `https://github.com/react-navigation/react-navigation/releases` | Bottom tab UI and custom tab bar. Must move with `@react-navigation/native`. | Upgrade with nav cluster. |
| `@react-navigation/elements` | `2.9.10` resolved | `2.9.15` | peers `@react-navigation/native ^7.2.2`, safe-area, optional masked-view | React Navigation releases: `https://github.com/react-navigation/react-navigation/releases` | Header/elements styling risk. Expected code changes low. | Upgrade with nav cluster. |
| `@react-native-community/datetimepicker` | `8.6.0` | Defer npm latest `9.1.0` unless Expo confirms | npm latest peers `expo >=52`, `react *`, `react-native *`; release `9.0.0` breaking: removed deprecated Android `positiveButtonLabel`, `negativeButtonLabel`, `neutralButtonLabel`; `9.1.0` adds granular event listeners | GitHub releases reviewed: `https://github.com/react-native-datetimepicker/datetimepicker/releases` | Used in transaction/transfer/goal/financial-account/bill date fields. Search did not show deprecated button label props in sampled usage, so likely no code change, but Android date field QA required. Native package; Expo SDK check did not list an expected bump. | Defer until Expo-compatible version is confirmed; otherwise test in isolated native PR. |
| `@react-native-community/netinfo` | `11.5.2` | Defer npm latest `12.0.1` unless Expo confirms | peers `react *`, `react-native >=0.59`; release `12.0.0` breaking: iOS 14+ minimum and Wi-Fi info now uses `NEHotspotNetwork` requiring Access Wi-Fi Information entitlement for SSID details | GitHub releases reviewed: `https://github.com/react-native-netinfo/react-native-netinfo/releases` | Local usage is `NetInfo.fetch()` in `shared/effect/network.ts`. No SSID use found, so entitlement probably unnecessary. Verify offline/online sync behavior. Native package; not listed by Expo check. | Defer or isolated PR with iOS QA. |
| `@sentry/react-native` | `7.11.0` | Defer npm latest `8.10.0` | peers `expo >=49`, `react >=17`, `react-native >=0.65`; Sentry has explicit `7.x -> 8.x` migration guide | Sentry migration page reviewed: `https://docs.sentry.io/platforms/react-native/migration/`; use `v7-to-v8` before PR | Local wrapper in `shared/lib/sentry.ts` uses `init`, `captureException`, `setUser`, `withScope`, `captureMessage`, `ErrorBoundary`, `wrap`; config plugin exists in `app.json` but not `app.config.ts`, so config drift must be resolved. | High-risk isolated major PR. |
| `@sentry/cli` | `3.3.3` | `3.4.1` | engine `node >=18` | Sentry CLI releases: `https://github.com/getsentry/sentry-cli/releases` | Build/source-map upload tooling. Expected code changes none; verify EAS/release build config. | Upgrade with Sentry PR or tooling PR. |
| `@shopify/flash-list` | `2.0.2` | `2.3.1` | peers `react *`, `react-native *`, `@babel/runtime *` | FlashList releases: `https://github.com/Shopify/flash-list/releases` | Used in review queues and chat/list screens. Check ref type changes and list layout behavior. | Upgrade isolated UI list PR. |
| `@supabase/supabase-js` | `2.99.1` | `2.105.1` | engine `node >=20`; no peer deps | Supabase JS releases: `https://github.com/supabase/supabase-js/releases` | Local Supabase client, auth session types, backup remote storage, edge calls. Expected code changes low for minor, but typecheck may reveal API shape changes. | Upgrade isolated runtime PR. |
| `@tanstack/react-query` | `5.90.5` | `5.100.7` | peers `react ^18 || ^19` | TanStack Query releases: `https://github.com/TanStack/query/releases` | Query client/provider/focus plus feature hooks. Expected code changes low; verify retries, invalidation, stale completion behavior. | Upgrade isolated runtime PR. |
| `posthog-react-native` | `4.37.6` | `4.44.0` | many optional peers including async-storage, navigation, expo-device/application/file-system/localization, session replay, safe-area, svg | PostHog JS releases: `https://github.com/PostHog/posthog-js/releases` | Local wrapper constructs `new PostHog(...)`. Peer list includes packages not all installed because many integrations are optional; verify no new hard runtime import. | Upgrade isolated analytics PR. |
| `lucide-react-native` | `0.575.0` | Defer npm latest `1.14.0` | peers `react ^16.5.1 || ^17 || ^18 || ^19`, `react-native *`, `react-native-svg ^12 || ^13 || ^14 || ^15` | Lucide releases: `https://github.com/lucide-icons/lucide/releases` | Central icon barrel in `shared/components/icons.ts`; likely import/name compatibility but large visual surface. Version crosses `0.x -> 1.x`, so inspect exported icon names before bump. | Isolated visual PR, maybe defer. |
| `react-native-gesture-handler` | `2.30.0` | Defer npm latest `2.31.1`; Expo check does not request bump | peers `react *`, `react-native *` | RNGH releases: `https://github.com/software-mansion/react-native-gesture-handler/releases` | Navigation gestures/touch handling. No direct import count beyond config/root usage. Native package; only upgrade with Expo/native cluster. | Defer unless Expo install selects it. |
| `react-native-reanimated` | `4.2.1` | Defer npm latest `4.3.0` | latest peers `react-native 0.81 - 0.85`, `react-native-worklets 0.8.x`; current SDK check wants worklets `0.7.4`, so latest Reanimated conflicts with Expo expected worklets | Reanimated releases/docs: `https://github.com/software-mansion/react-native-reanimated/releases` | Used in animation hooks and UI components. Moving to `4.3.0` implies worklets `0.8.x`; do not do under current Expo check. | Defer. |
| `react-native-safe-area-context` | `5.6.2` | Defer npm latest `5.7.0`; Expo check does not request bump | peers `react *`, `react-native *`; Expo Router requires `>=5.4.0`, current satisfies | Releases: `https://github.com/AppAndFlow/react-native-safe-area-context/releases` | Used in layout/navigation spacing. Low code-change risk, but visual QA required. | Defer unless Expo install selects it. |
| `react-native-screens` | `4.23.0` | Defer npm latest `4.24.0`; Expo check does not request bump | peers `react *`, `react-native *`; Expo Router accepts any | Releases: `https://github.com/software-mansion/react-native-screens/releases` | Navigation lifecycle/native screens. Native QA required. | Defer unless Expo install selects it. |
| `react-native-svg` | `15.15.3` | `15.15.4` or Expo-compatible | `lucide-react-native` supports `^15`; PostHog peer `>=15` | Releases: `https://github.com/software-mansion/react-native-svg/releases` | Used in logo, charts, rings, icons. Patch likely no code change; visual QA charts/logo. | Upgrade in UI/native patch PR if Expo-compatible. |
| `tailwindcss` | `3.4.19` | Defer `4.2.4` | no peer deps from npm; NativeWind compatibility is the real constraint | Tailwind v4 upgrade guide reviewed: `https://tailwindcss.com/docs/upgrade-guide` | App uses NativeWind/Tailwind config and many `className` strings. v4 changes config/CSS model, removed/renamed utilities, border/ring defaults, JS config discovery. NativeWind v4 currently pairs with Tailwind v3-style config, so do not upgrade blindly. | Defer until NativeWind v4/Tailwind v4 compatibility is proven. |
| `zod` | `4.3.6` | `4.4.1` | no peer deps | Zod releases: `https://github.com/colinhacks/zod/releases` | Schemas throughout features and LLM parsing. Minor should be low code-change, but verify parse errors and inferred types. | Upgrade isolated schema PR. |
| `zustand` | `5.0.11` | `5.0.12` | peers optional React/use-sync-external-store/immer; engine `node >=12.20` | Zustand releases: `https://github.com/pmndrs/zustand/releases` | Stores throughout app. Patch likely no code change; run store tests. | Upgrade runtime patch PR. |
| `better-sqlite3` | `12.8.0` | `12.9.0` | engine `node 20.x || 22.x || 23.x || 24.x || 25.x` | Releases: `https://github.com/WiseLibs/better-sqlite3/releases` | Test/tooling DB usage only; native Node addon. Verify local install and DB tests. | Upgrade tooling PR. |
| `drizzle-kit` | `0.31.9` | `0.31.10` | no peer deps from npm metadata | Drizzle releases: `https://github.com/drizzle-team/drizzle-orm/releases` | Migration generation only. Remember repo rule: update `apps/mobile/drizzle/migrations.js` manually after generation. | Upgrade tooling PR. |
| `knip` | `6.3.1` | `6.10.0` | engine `node ^20.19.0 || >=22.12.0` | Knip releases: `https://github.com/webpro-nl/knip/releases` | Dead-code lint may change findings. Expected config-only/no code unless new findings. | Upgrade tooling PR after CI Node version check. |
| `eslint` | `9.39.4` | Defer `10.3.0` | peer `jiti *`; engine `node ^20.19.0 || ^22.13.0 || >=24`; Expo lint compatibility unknown | ESLint releases: `https://github.com/eslint/eslint/releases` | `expo lint` and config compatibility risk. Major PR only after `eslint-config-expo` supports it. | Defer. |
| `vitest` | `4.1.0` resolved | `4.1.5` | peers optional `vite`, `@vitest/coverage-v8 4.1.5`, browser packages; engine `node ^20 || ^22 || >=24` | Vitest releases: `https://github.com/vitest-dev/vitest/releases` | Test runner and setup. Keep `@vitest/coverage-v8` in lockstep. | Upgrade test tooling PR. |
| `@vitest/coverage-v8` | `4.1.0` resolved | `4.1.5` | peers exactly `vitest 4.1.5` for target | Vitest releases: `https://github.com/vitest-dev/vitest/releases` | Coverage only. Must match Vitest. | Upgrade with Vitest. |
| `@stryker-mutator/core` | `9.6.0` | `9.6.1` | engine `node >=20` | Stryker releases: `https://github.com/stryker-mutator/stryker-js/releases` | Mutation testing config only. Run mutation command if changed. | Upgrade test tooling PR. |
| `effect` | `3.21.0` | `3.21.2` | no peer deps from npm metadata | Effect releases: `https://github.com/Effect-TS/effect/releases` | Used in shared effect runners and services. Patch likely no code change; run effect-heavy tests. | Upgrade runtime/tooling PR. |
| `@biomejs/biome` | `2.4.4` | `2.4.13` | engine `node >=14.21.3` | Biome releases: `https://github.com/biomejs/biome/releases` | Formatting/lint rules may change findings. Run `bun run lint`. | Upgrade tooling PR. |
| `bun-types` | `1.3.10` | `1.3.13` | no peer deps | Bun releases: `https://github.com/oven-sh/bun/releases` | Type surface for scripts/tests. Keep package manager pinned unless intentionally upgrading Bun runtime. | Upgrade types only, or defer until Bun runtime moves. |
| `lefthook` | `2.1.1` | `2.1.6` | no peer deps | Lefthook releases: `https://github.com/evilmartians/lefthook/releases` | Git hooks. Verify pre-commit/pre-push still run. | Upgrade tooling PR. |

### Stale-Upstream Policy Decisions

These packages are policy violations mainly because latest stable is older than 30 days, not because a newer stable upgrade exists. They need an allowlist, replacement review, or policy relaxation entry.

| Package | Current | Latest stable | Local impact | Decision needed |
| --- | --- | --- | --- | --- |
| `@babel/plugin-transform-react-jsx` | `7.28.6` | `7.28.6` | Babel dev dependency. | Allowlist unless Expo/Babel preset no longer needs it. |
| `@expo-google-fonts/poppins` | `0.4.1` | `0.4.1` | Font loading/typography. | Allowlist or replace with bundled font assets. |
| `@expo/vector-icons` | `15.1.1` resolved | `15.1.1` | Icon rendering. | Allowlist; Expo-managed. |
| `@types/better-sqlite3` | `7.6.13` | `7.6.13` | Test/tooling types. | Allowlist. |
| `@types/react` | `19.2.14` resolved | `19.2.14` | Typecheck. | Allowlist; keep aligned with React/Expo. |
| `babel-plugin-inline-import` | `3.0.0` | `3.0.0` | Babel plugin. | Review if still needed; otherwise replace/remove. |
| `burnt` | `0.13.0` | `0.13.0` | Toast wrapper in `shared/lib/toast.ts`. | Consider replacement if unmaintained; otherwise allowlist. |
| `date-fns` | `4.1.0` | `4.1.0` | Date formatting/derivations everywhere. | Allowlist; no upgrade exists. |
| `dependency-cruiser` | `17.3.10` | `17.3.10` | Architecture lint. | Allowlist. |
| `drizzle-orm` | `0.45.2` | `0.45.2` | DB/query layer. | Allowlist; no upgrade exists. |
| `eslint-config-expo` | `55.0.0` | `55.0.0` | `expo lint`. | Allowlist; Expo-managed. |
| `eslint-plugin-boundaries` | `6.0.2` | `6.0.2` | Architecture lint. | Allowlist. |
| `eslint-plugin-import` | `2.32.0` | `2.32.0` | ESLint. | Allowlist. |
| `expo-android-notification-listener-service` | `1.1.0` | `1.1.0` | Android notification listener. | High scrutiny; replace or allowlist with Android QA. |
| `expo-atlas` | `0.4.3` | `0.4.3` | Bundle analysis only. | Allowlist. |
| `i18n-js` | `4.5.3` | `4.5.3` | Translation runtime. | Allowlist unless replacing i18n stack. |
| `nativewind` | `4.2.3` | `4.2.3` | Styling runtime/compiler. | Allowlist; blocks Tailwind v4 until compatibility proven. |
| `react-native-css-interop` | `0.2.3` | `0.2.3` | NativeWind dependency. | Allowlist with NativeWind. |
| `react-native-web` | `0.21.2` | `0.21.2` | Web target. | Allowlist; Expo-managed. |
| `xcodebuildmcp` | `2.3.2` | `2.3.2` | QA tooling. | Allowlist. |

## Suggested First PRs

1. Policy calibration: introduce an explicit stale-upstream allowlist or ledger so CI can distinguish non-actionable packages from real update debt.
2. Root tooling patch PR: `@biomejs/biome`, `bun-types`, `lefthook`, and maybe `knip` if changelog review is clean.
3. Mobile test tooling patch PR: `vitest`, `@vitest/coverage-v8`, and `@stryker-mutator/core` if mutation config remains compatible.
4. Expo SDK 55 patch alignment PR using Expo-compatible versions only.
5. Runtime library PRs one cluster at a time: Supabase, TanStack Query, Zod, Zustand/date/i18n.

## Do Not Do

- Do not run one giant `bun update` PR.
- Do not upgrade React Native independently of Expo SDK support.
- Do not upgrade Tailwind to v4 until NativeWind compatibility is confirmed.
- Do not treat stale-upstream packages as automatically bad if they are intentionally stable and still maintained enough for this app.
- Do not merge a native dependency bump without simulator QA.
