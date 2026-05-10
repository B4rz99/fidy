# SDK 56 Improvements Plan

## Goal

Use Expo SDK 56 changes to reduce native dependency risk, improve runtime/build performance, and simplify future SDK upgrades without changing Fidy's local-first financial architecture.

## Priority Work

### 1. Remove direct React Navigation surface

Status: completed in PR 407.

SDK 56 decouples Expo Router from React Navigation. Direct `@react-navigation/*` imports can now break unexpectedly or keep unnecessary dependencies installed.

Tasks:

- Audit app imports for direct `@react-navigation/*` usage.
- Remove unused React Navigation bridge components.
- Remove unused direct React Navigation dependencies from `apps/mobile/package.json`.
- Keep regression coverage that prevents direct React Navigation imports under `apps/mobile`.

Expected benefit:

- Smaller native/JS dependency surface.
- Fewer Expo Router compatibility traps.
- Cleaner SDK 56 router posture.

### 2. Spike Expo UI DateTimePicker replacement

Status: completed in PR 409; manual iOS/Android QA is still recommended for native picker presentation and dismissal behavior.

SDK 56 introduces `@expo/ui/community/datetime-picker` as a drop-in replacement for `@react-native-community/datetimepicker`.

Tasks:

- Migrate one contained date field first.
- Verify iOS and Android behavior manually for date selection, dismissal, and form persistence.
- If behavior matches, migrate the remaining date fields.
- Remove `@react-native-community/datetimepicker` once all imports are gone.

Expected benefit:

- Fewer community native dependencies.
- Better alignment with Expo-managed native primitives.
- Lower upgrade risk for core financial forms.

Migration result:

- All DateTimePicker usage now imports from `@expo/ui/community/datetime-picker`.
- The app uses Expo UI `onValueChange` and `onDismiss` instead of the deprecated community picker `onChange` API.
- Android dismiss/cancel/backdrop behavior remains explicit so dismissed pickers do not commit dates.
- `@react-native-community/datetimepicker` was removed once source imports were gone.

### 3. Add declarative Android NavigationBar handling

Status: completed in PR 407; Android edge-to-edge behavior still needs manual device/simulator QA.

SDK 56 aligns `expo-status-bar` and `expo-navigation-bar` around declarative components.

Tasks:

- Add `expo-navigation-bar` if not already installed.
- Render `<NavigationBar />` alongside `<StatusBar />` in the root layout.
- Match the app's automatic light/dark system UI behavior.
- Verify Android edge-to-edge behavior.

Expected benefit:

- More explicit system-bar behavior.
- Better Android polish with edge-to-edge enabled.

### 4. Plan vector icon migration

Status: completed in PR 407 for the current icon surface.

SDK 56 deprecates `@expo/vector-icons` in favor of scoped `@react-native-vector-icons/*` packages.

Tasks:

- Inventory current icon sets.
- Run or manually apply the vector-icons migration for the small current usage surface.
- Update tests/mocks.
- Remove `@expo/vector-icons` once imports are gone.

Expected benefit:

- Removes a newly deprecated Expo wrapper.
- Keeps icons closer to upstream fixes.

### 5. Explore SQLite SDK 56 improvements for backup/sync

Status: reviewed in PR 407; no immediate SDK 56 SQLite/FileSystem migration is warranted.

SDK 56 improves `expo-sqlite` with native `ArrayBuffer` blob support, statement bind params, and session changesets.

Tasks:

- Review encrypted backup/import/export for blob or streaming opportunities.
- Spike session changesets only if they can support future local-first sync without plaintext remote tables.
- Avoid replacing Drizzle-owned query paths without profiling or a clear reliability win.

Expected benefit:

- Better future backup/sync primitives.
- Potentially safer binary handling for local snapshots.

Review result:

- Encrypted backup/export currently uses Drizzle-owned table reads/writes, validates a row-shaped JSON snapshot, encrypts that snapshot with Web Crypto, and uploads the encrypted JSON envelope through signed Supabase Storage URLs.
- No `expo-file-system`, document-picker, or local file read/write APIs are currently used under `apps/mobile`, so SDK 56 File/Blob APIs do not replace an active backup path.
- SDK 56 SQLite `Uint8Array` BLOB support is useful for future binary columns, but the current backup format intentionally stores encrypted ciphertext as base64 inside the remote JSON envelope for metadata validation and transport compatibility.
- SDK 56 SQLite sessions/changesets are promising for future local-first sync experiments, but adopting them now would introduce a new conflict/sync model and would not directly improve encrypted backup restore reliability.
- Keep Drizzle-owned snapshot import/export unchanged unless profiling shows a restore bottleneck or a future sync design explicitly chooses changesets.

### 6. Measure SDK 56 runtime/build benefits

Status: measurement protocol defined in PR 407; actual before/after numbers require a dev-client or release QA run with a comparable pre-SDK-56 baseline.

SDK 56 adds Hermes V1, Expo Modules runtime improvements, precompiled iOS Expo packages, and faster Expo CLI behavior.

Tasks:

- Capture baseline startup/first-render timing on dev-client or release builds.
- Compare Android/iOS native build time before and after SDK 56 where possible.
- Keep precompiled modules enabled unless a native build issue requires opting out.

Expected benefit:

- Confirms automatic SDK 56 wins in this app.
- Prevents speculative JS optimization work.

Measurement protocol:

- Bundle size and module graph: run `bun run perf:bundle:mobile`, then inspect `.expo/atlas.jsonl` with `bun run --cwd apps/mobile --shell=bun bundle:atlas:open`.
- Local iOS startup smoke: run `bun run qa:ios`, then capture app launch, first interactive route, SQLite open/migration, notifications bootstrap, and backup screen navigation timing from simulator/device logs.
- Native build timing: compare clean `expo run:ios` / `expo run:android` or EAS preview build durations against the previous SDK 55 branch using the same machine/profile.
- Keep precompiled iOS Expo packages enabled by default; only opt out if native build logs show a concrete precompiled-module failure.
- Do not claim Hermes V1 or Expo Modules runtime wins from JS-only tests; use device/simulator startup traces or build logs.

### 7. Review Expo Widgets for the App Intents shortcut extension

Status: reviewed after PR 409; no immediate `expo-widgets` migration is warranted.

SDK 56 introduces `expo-widgets` for iOS home screen widgets and Live Activities built with Expo UI components.

Tasks:

- Compare Expo Widgets config plugin behavior against the existing `withFidyWidget` plugin.
- Check whether Expo Widgets can replace the current empty WidgetKit target used only to host App Intents.
- Check whether App Group `UserDefaults` queueing and the local Expo module bridge remain necessary.

Expected benefit:

- Avoids carrying custom native widget setup if Expo provides an equivalent managed primitive.

Review result:

- Fidy's `FidyWidgetBundle.swift` intentionally renders no useful widget UI; the target exists to host `QuickExpenseIntent` for Back Tap / Shortcuts discovery.
- `expo-widgets` generates rendered WidgetKit and Live Activity surfaces from Expo UI components. Its documented API covers widget timelines, live activity lifecycle, push tokens, and widget interaction events, not defining App Intent parameters or an App Intents-only extension.
- The current App Group `UserDefaults` bridge is still the handoff point between the App Intent extension and the local-first SQLite app. `expo-widgets` does not replace the pending transaction queue or `modules/expo-app-intents` reader/removal API.
- Replacing the plugin now would likely add an unnecessary real widget target while losing the custom App Intent source files that power quick transaction capture.
- Keep `withFidyWidget` and the local `expo-app-intents` module until Fidy designs an actual widget or Live Activity surface, or Expo documents first-class App Intents generation for shortcut-style intents.

## Deferred Work

- Actual home screen widget or Live Activity design, if product value is clear.
- Inline Expo Modules only if custom native code grows beyond config-plugin glue.
- Expo UI broader component adoption after the DateTimePicker migration proves stable.
- `expo/fetch` behavior review if OAuth/email/backup fetch flows show regressions.

## Verification Standard

For each completed slice:

- Run the narrowest relevant test or source guard first.
- Run mobile lint and typecheck for app-code changes.
- Run full pre-push/verify before pushing broad dependency or native-surface changes.
- Add regression tests for import boundaries and user-visible behavior changes.
