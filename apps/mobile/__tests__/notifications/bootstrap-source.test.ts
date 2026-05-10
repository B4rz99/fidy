import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../features/notifications/bootstrap.ts"),
  "utf-8"
);

describe("notification bootstrap", () => {
  it("does not subscribe to push-token changes that recursively fetch Expo tokens", () => {
    expect(source).toContain("registerCurrentPushToken(userId)");
    expect(source).not.toContain("addPushTokenListener");
    expect(source).not.toContain("registerKnownPushToken(userId, token.data)");
  });

  it("keeps notification response navigation subscribed", () => {
    expect(source).toContain("addNotificationResponseReceivedListener");
    expect(source).toContain("responseSub.remove()");
  });
});
