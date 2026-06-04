import { describe, expect, it } from "vitest";
import { parseNotificationWithRegex } from "@/features/capture-sources/services/notification-regex-parser";
import type { NotificationData } from "@/features/capture-sources/schema";

const notification: NotificationData = {
  packageName: "com.bbva.nxt_colombia",
  title: "Compra",
  text: "Compra en Cafe por $12.500",
  timestamp: new Date("2026-04-19T10:00:00.000Z").getTime(),
};

describe("parseNotificationWithRegex", () => {
  it("parses purchase notifications with fallback notification date and card hint", () => {
    expect(
      parseNotificationWithRegex(
        notification,
        "Compra aprobada en Cafe Central por COP 12.500 tarjeta terminada en 1234"
      )
    ).toEqual({
      kind: "parsed",
      parsed: expect.objectContaining({
        amount: 12500,
        merchant: "Cafe Central",
        date: "2026-04-19",
        cardProductHint: "tarjeta 1234",
      }),
    });
  });

  it("parses explicit short dates and rejects invalid explicit dates", () => {
    expect(
      parseNotificationWithRegex(notification, "Payment at Store for $9,900 on 2/3/26")
    ).toEqual({
      kind: "parsed",
      parsed: expect.objectContaining({ amount: 9900, date: "2026-03-02" }),
    });

    expect(parseNotificationWithRegex(notification, "Payment at Store for $9,900 on nope")).toEqual(
      expect.objectContaining({ kind: "parsed" })
    );
  });

  it("returns unsupported or failed results when the package or content cannot be parsed", () => {
    expect(
      parseNotificationWithRegex({ ...notification, packageName: "com.unknown" }, notification.text)
    ).toEqual({ kind: "unsupported" });

    expect(parseNotificationWithRegex(notification, "No amount here")).toEqual(
      expect.objectContaining({ kind: "failed" })
    );
  });
});
