---
name: mobile-qa
description: >
  Manual QA workflow for Fidy Expo/React Native iOS worktrees on the iPhone 17
  simulator. Use when testing a branch or PR in apps/mobile, especially when
  you need the repo's local QA mode, root `qa:*` commands, Expo dev client, and
  XcodeBuildMCP verification without rediscovering harness rules.
---

# Mobile QA

Use this skill for real iOS simulator QA on Fidy mobile branches. This is for
manual and hybrid QA, not a substitute for unit tests.

## Core Rules

- Test only on `iPhone 17`
- Prefer the repo harness over ad hoc Expo commands
- Use the repo-local XcodeBuildMCP config at `.xcodebuildmcp/config.yaml`
- Start with `snapshot_ui` before taps or typing
- Prefer local QA mode over a real personal account

## Canonical Flow

Run all QA commands from the repo root:

```bash
cd /abs/worktree
```

Primary commands:

- `bun qa:ios`
  - starts Metro on `localhost:8081` if needed
  - builds/runs the iOS sim app on `iPhone 17`
  - opens the Expo dev client
- `bun qa:seed <profile>`
  - boots the local QA profile and routes to that profile's default screen
- `bun qa:reset <profile>`
  - same harness path as seed; use to get back to a known profile quickly
- `bun qa:open <route> <profile>`
  - starts the profile and opens a specific QA target
- `bun qa:smoke`
  - runs the built-in smoke pass and writes artifacts to `.context/mobile-qa/`

Common examples:

```bash
bun qa:ios
bun qa:seed transfer-ready
bun qa:open /add-transfer transfer-ready
bun qa:open /qa-transfer-conflict transfer-conflict
bun qa:smoke
```

## Harness Checks

Before testing:

1. Confirm the worktree and branch are correct
   - `git status --short --branch`
2. Confirm Metro is really up
   - `curl -sSf http://localhost:8081/status`
   - expected: `packager-status:running`
3. Confirm XcodeBuildMCP defaults
   - use `session_show_defaults`
   - expected simulator: `iPhone 17`
4. Confirm the app is attached to this worktree's bundle
   - use `snapshot_ui`
   - avoid assuming the visible simulator is current

Stop and fix the harness first if:

- `curl` fails
- the app is obviously running an old branch bundle
- the dev client is not attached to Metro
- simulator automation is unavailable and there is no fallback

## Dev Client Behavior

This repo now uses `expo-dev-client` iOS `launchMode: "launcher"`.

Implications:

- `bun qa:ios` is still the preferred entrypoint
- tapping the app icon is acceptable after the dev client has been rebuilt for
  the current native config
- if the app opens to a stale or broken bundle, prefer rerunning `bun qa:ios`
  before blaming product code

If you need to force-open the dev client manually, use:

```bash
xcrun simctl openurl booted \
  "com.googleusercontent.apps.282682681790-630ti7lmdsjcm32o31m1kq50q20727pn://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

In this repo, `localhost` is the correct host for the simulator harness. Do not
switch to `127.0.0.1` unless you have current evidence that the harness changed.

## Local QA Mode

Routine QA should not use a real personal account.

Use the dev-only local QA path:

- login screen button: `Continue in local QA mode`
- profile card actions:
  - reset local QA
  - open QA tools
  - exit local QA

Local QA is gated by app code and is intended for dev/test usage only.

Current profiles:

- `default`
- `empty`
- `two-accounts`
- `transfer-ready`
- `transfer-conflict`

If a QA flow depends on app state, start from one of these profiles instead of
building the state manually.

## QA Routes And Entry Points

Useful route targets for `bun qa:open`:

- `/(tabs)/(index)` -> home
- `/(tabs)/add` -> add chooser
- `/add-transaction`
- `/add-transfer`
- `/qa-transfer-conflict`
- `/financial-accounts`
- `/profile`
- `/qa-tools`

There are also direct QA deep links:

- `fidy://qa-open?profile=transfer-ready&targetKey=add-transfer`
- `fidy://qa-tools`

Use those when the CLI path is not enough or when verifying routing behavior.

## QA Tools Screen

`/qa-tools` is the repo's manual QA control center.

Use it to:

- switch profiles
- reset the current scenario
- reset QA feature flags
- clear QA logs
- clear captured network events
- exit local QA
- jump straight to key screens

Feature flags currently exposed there:

- network inspector
- log inspector
- simulate offline
- show QA banner

When a branch changes the QA harness itself, verify `/qa-tools` still renders
and still shows the active profile.

## XcodeBuildMCP Usage

Use the repo-local config, then inspect the UI tree before interacting.

Preferred sequence:

1. `session_show_defaults`
2. `snapshot_ui`
3. targeted interaction
4. `screenshot` for evidence

Prefer:

- `snapshot_ui`
- `screenshot`
- `tap`
- `type_text`

If wrapper availability is incomplete in this harness, the packaged CLI is an
acceptable fallback from the repo root.

If XcodeBuildMCP UI wrappers are unavailable or insufficient, use `axe` as the
fallback inspector/driver:

- `axe describe-ui`
- `axe tap`
- `axe swipe`
- `axe type`

## Selector Strategy

This app's QA flow depends on stable automation hooks.

Rules:

- prefer `testID` and accessibility identifiers
- use accessibility semantics as real product semantics, not test-only hacks
- treat hidden inputs, gesture-only dismissal, and inaccessible custom controls
  as QA smells
- ensure important controls expose real accessibility nodes with stable names
- wrappers should not swallow interactive children in the accessibility tree
- iOS sheets, pickers, and date controls need explicit dismiss paths

When automation cannot interact reliably:

1. inspect `snapshot_ui`
2. confirm the control is a real accessibility node
3. check for missing dismiss/focus paths
4. only then fall back to coordinate guessing

Common smells from this repo:

- hidden `TextInput` patterns that look editable but do not focus reliably
- iOS spinner or picker UI with no Done/Cancel or other close path
- custom sheet content that renders visually but not as actionable accessibility
  nodes
- app routes importing UI-heavy feature barrels into pure code paths

## Findings And Evidence

Record:

- pass/fail
- repro steps
- expected vs actual
- severity
- whether it is a harness issue or a product issue

Capture:

- screenshots for visual issues
- `snapshot_ui` around the failing state
- `.context/mobile-qa/` artifacts for smoke runs

Do not report harness failures as product regressions.

## Fidy-Specific Notes

- `qa-open` and `qa-tools` are part of the intended harness, not debug noise
- some warnings from native/background systems are simulator limitations, not
  branch bugs by themselves
- if local QA seeding fails, inspect the QA logs before assuming the feature
  screen is broken
- if a pure service/test starts importing React Native unexpectedly, check
  whether a feature barrel now exports UI and use a deeper or `routes.public.ts`
  import instead
- if QA routing looks broken, verify the current profile in `/qa-tools` before
  debugging the destination screen
- if icon launch behaves differently from URL launch, rerun `bun qa:ios` and
  confirm the dev client rebuild picked up launcher mode
