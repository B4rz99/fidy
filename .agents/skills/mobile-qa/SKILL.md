---
name: mobile-qa
description: >
  Manual QA workflow for Fidy Expo/React Native iOS worktrees using Metro, the
  installed Expo dev client, the configured iOS simulator, and serve-sim visual
  verification.
---

# Mobile QA

Use this skill for manual visual QA of Fidy mobile changes. The reliable path
is: start Metro, open the simulator, launch Fidy, then use `serve-sim` only as
the browser viewer after the app is already rendering.

## Best Path

Run from the repo root unless a command says otherwise.

1. Stop stale viewers and any Metro process on `8081` when you own this QA
   session:

   ```bash
   bun sim:serve:kill
   lsof -tiTCP:8081 -sTCP:LISTEN | xargs kill
   ```

2. Start Metro for the Expo dev client and keep the LAN IP for the launch URL:

   ```bash
   IP=$(ipconfig getifaddr en0)
   cd apps/mobile
   CI=1 bun x expo start --dev-client --host lan --port 8081 --clear
   ```

   Wait until Metro prints that it is waiting on `8081`, then confirm from the
   repo root:

   ```bash
   curl -sSf http://127.0.0.1:8081/status
   ```

   Expected output:

   ```text
   packager-status:running
   ```

3. Boot/open the configured simulator:

   ```bash
   xcrun simctl boot "iPhone 17 Pro"
   open -a Simulator
   ```

4. Launch Fidy or the Expo dev client:

   ```bash
   IP=$(ipconfig getifaddr en0)
   xcrun simctl openurl booted "exp+fidy://expo-development-client/?url=http%3A%2F%2F${IP}%3A8081"
   ```

   If iOS shows an "Open?" prompt, tap `Open`. If the deep link is flaky but
   the simulator home screen shows the Fidy icon, tap the Fidy icon manually.

5. Navigate to the screen under test with app UI or a direct deep link:

   ```bash
   xcrun simctl openurl booted "fidy:///(tabs)/(ai)"
   xcrun simctl openurl booted "fidy:///(tabs)/(index)"
   xcrun simctl openurl booted "fidy://add-transaction"
   ```

6. Only after the app renders, start one browser stream:

   ```bash
   cd ../..
   bun sim:serve
   ```

   Open the printed root URL in the Codex in-app browser. Do not open
   `/stream.mjpeg` unless you specifically need the raw stream.

## Rules

- `serve-sim` only streams the current Simulator image. It does not load the
  app, fix Metro, or drive taps.
- Do not start multiple `serve-sim` instances. Use `bun sim:serve:list` and
  `bun sim:serve:kill` if ports pile up.
- If the app shows a red dev-client screen for `127.0.0.1:8081`, fix Metro
  first. The simulator viewer is not the problem.
- Use simulator tools or direct deep links for interaction; use the browser
  stream primarily for visual QA.
