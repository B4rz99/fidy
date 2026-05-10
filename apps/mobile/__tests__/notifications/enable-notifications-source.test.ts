import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../../app/enable-notifications.tsx"), "utf-8");

describe("enable notifications sheet", () => {
  it("keeps permission requests bounded so the sheet can recover from native stalls", () => {
    expect(source).toContain("requestNotificationPermissionStatus");
    expect(source).toContain("PERMISSION_REQUEST_TIMEOUT_MS");
  });

  it("does not block dismissal on push token registration", () => {
    expect(source).toContain("void registerPushToken(userId).catch(captureError)");
    expect(source).not.toContain("await registerPushToken(userId)");
  });

  it("keeps late granted permission results eligible for token registration", () => {
    expect(source).toContain("const permissionRequest = Notifications.requestPermissionsAsync()");
    expect(source).toContain("requestPermissions: () => permissionRequest");
    expect(source).toContain("actionVersionRef.current !== actionVersion");
  });

  it("does not block dismissal on persisting the pre-permission flag", () => {
    expect(source).toContain("void SecureStore.setItemAsync(PRE_PERMISSION_KEY");
    expect(source).not.toContain("await SecureStore.setItemAsync(PRE_PERMISSION_KEY");
  });

  it("keeps the Not Now action available while the enable request is pending", () => {
    expect(source.match(/disabled=\{isRequesting\}/g)).toHaveLength(1);
  });

  it("emits development-stage logs for diagnosing native notification hangs", () => {
    expect(source).toContain("[notifications:enable-prompt]");
    expect(source).toContain("enable_tapped");
    expect(source).toContain("permission_finished");
    expect(source).toContain("not_now_tapped");
  });
});
