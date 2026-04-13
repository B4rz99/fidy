---
name: mobile-qa
description: >
  Manual QA workflow for Fidy Expo/React Native iOS worktrees on the iPhone 17
  simulator. Use when testing a branch or PR in apps/mobile, especially when
  you need Metro + Expo dev client attachment, XcodeBuildMCP UI automation, and
  branch-by-branch simulator verification without repeating setup mistakes.
---

# Mobile QA

Use this skill for real manual QA on Fidy mobile branches. This is for simulator
testing, not unit tests.

## What This Skill Prevents

- Launching the installed app icon before Metro is attached
- Testing the wrong worktree
- Assuming `127.0.0.1:8081` works when this environment expects `localhost:8081`
- Reusing stale Metro state across branches
- Mistaking simulator-only native limitations for branch regressions

## Preconditions

- Test only on `iPhone 17`
- Prefer `apps/mobile/ios/Fidy.xcworkspace` with scheme `Fidy`
- Verify UI automation tools first
  - Prefer `mcp__XcodeBuildMCP__tap`, `swipe`, `type_text`, `snapshot_ui`, `screenshot`
  - If those are unavailable, fall back to `axe describe-ui`, `axe tap`, `axe swipe`, `axe type`

## Required Branch Setup

For each worktree:

1. Verify the tree is clean
   - `git -C /abs/worktree status --short --branch`
2. Install deps only if needed
   - `cd /abs/worktree`
   - `bun install`
3. Start Metro from the target worktree app folder
   - `cd /abs/worktree/apps/mobile`
   - `CI=1 bun x expo start --dev-client --host localhost --port 8081 --clear`
4. Wait until Metro is actually up
   - `curl -sSf http://localhost:8081/status`
   - Expected: `packager-status:running`

Do not continue until the status endpoint succeeds.

## Simulator Attach Flow

Do not tap the `Fidy` app icon.

Open the dev client explicitly:

```bash
xcrun simctl openurl booted "com.googleusercontent.apps.282682681790-630ti7lmdsjcm32o31m1kq50q20727pn://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

Rules:

- Keep only the target branch's Metro server active on `8081`
- Re-run the open-url command when switching branches
- If the app shows `No script URL provided`, it is still not connected
- In this repo environment, `localhost` worked and `127.0.0.1` did not

## Worktree Switching

When moving to the next branch:

1. Stop the previous Metro process
2. Start Metro from the new worktree's `apps/mobile`
3. Re-check `curl -sSf http://localhost:8081/status`
4. Re-open the dev client URL
5. Wait for the new bundle to finish loading before testing

Do not assume the simulator is running the new branch until Metro rebundles.

## Manual QA Rules

- Manual feature QA only, do not substitute test suites for user flows
- Exercise the changed area directly from the UI whenever reachable
- Use `snapshot_ui` before and after key actions
- Capture screenshots for real findings
- Record:
  - pass/fail
  - repro steps
  - observed vs expected
  - severity
  - merge-blocking or regression-risk

## Fidy-Specific Notes

- `Connected Emails`, `Notifications`, `Categories`, budgets, sync conflicts, and similar screens are reachable from Settings or home banners
- Some capture flows are native/background driven
  - Widget capture uses the app group pending transaction store
  - Apple Pay and SMS capture rely on iOS/native triggers and may need simulator-specific setup
- Simulator warnings like background-task unavailability are not branch bugs by themselves
- A failed Metro/dev-client attach is a harness problem, not a product finding

## Minimal QA Checklist

- UI automation available and simulator target correct
- Git status clean
- Metro started from the correct worktree
- `curl -sSf http://localhost:8081/status` passes
- Dev client opened by URL, not app icon
- Bundle finishes loading
- Feature area exercised manually
- Findings captured with evidence

## Stop Conditions

Stop and fix the harness before testing if:

- `curl` fails
- the dev client shows `No script URL provided`
- the app is clearly running an old branch bundle
- simulator automation is unavailable and there is no fallback tool
