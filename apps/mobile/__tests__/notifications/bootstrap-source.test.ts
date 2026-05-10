import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../features/notifications/bootstrap.ts"),
  "utf-8"
);

describe("notification bootstrap", () => {
  it("does not recursively fetch push tokens from the push-token listener", () => {
    expect(source).toContain("registerCurrentPushToken(userId)");
    expect(source).toContain("addPushTokenListener");
    expect(source).toContain("addPushTokenListener(() =>");
    expect(source).toMatch(
      /addPushTokenListener\(\(\) => \{\s+registerCurrentPushToken\(userId\);\s+\}\)/
    );
    expect(source).not.toContain("registerKnownPushToken(userId, token.data)");
  });

  it("keeps notification response navigation subscribed", () => {
    expect(source).toContain("addNotificationResponseReceivedListener");
    expect(source).toContain("responseSub.remove()");
  });
});
