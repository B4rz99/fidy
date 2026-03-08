import { describe, expect, it } from "vitest";
import {
  applePayIntentDataSchema,
  KNOWN_BANK_PACKAGES,
  notificationDataSchema,
  resolveSource,
  smsDetectionDataSchema,
} from "@/features/capture-sources/schema";

describe("notificationDataSchema", () => {
  it("accepts valid notification data", () => {
    const result = notificationDataSchema.safeParse({
      packageName: "com.todo1.mobile.co.bancolombia",
      text: "Compra por $50,000",
      timestamp: 1709827200000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts data with all optional fields", () => {
    const result = notificationDataSchema.safeParse({
      packageName: "com.nequi.MobileApp",
      title: "Nequi",
      text: "Enviaste $20,000",
      subText: "Cuenta ahorros",
      bigText: "Enviaste $20,000 a Maria Garcia desde tu cuenta de ahorros",
      timestamp: 1709827200000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects data missing packageName", () => {
    const result = notificationDataSchema.safeParse({
      text: "Compra por $50,000",
      timestamp: 1709827200000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects data missing text", () => {
    const result = notificationDataSchema.safeParse({
      packageName: "com.todo1.mobile.co.bancolombia",
      title: "Bancolombia",
      timestamp: 1709827200000,
    });
    expect(result.success).toBe(false);
  });
});

describe("applePayIntentDataSchema", () => {
  it("accepts valid apple pay intent data", () => {
    const result = applePayIntentDataSchema.safeParse({
      amount: 25000,
      merchant: "STARBUCKS",
    });
    expect(result.success).toBe(true);
  });

  it("accepts data with optional card field", () => {
    const result = applePayIntentDataSchema.safeParse({
      amount: 25000,
      merchant: "STARBUCKS",
      card: "Visa *1234",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.card).toBe("Visa *1234");
    }
  });

  it("rejects amount of zero", () => {
    const result = applePayIntentDataSchema.safeParse({
      amount: 0,
      merchant: "STARBUCKS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = applePayIntentDataSchema.safeParse({
      amount: -5000,
      merchant: "STARBUCKS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty merchant string", () => {
    const result = applePayIntentDataSchema.safeParse({
      amount: 25000,
      merchant: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("smsDetectionDataSchema", () => {
  it("accepts valid sms detection data", () => {
    const result = smsDetectionDataSchema.safeParse({
      senderName: "Bancolombia",
      timestamp: "2024-03-07T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects data missing senderName", () => {
    const result = smsDetectionDataSchema.safeParse({
      timestamp: "2024-03-07T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty senderName", () => {
    const result = smsDetectionDataSchema.safeParse({
      senderName: "",
      timestamp: "2024-03-07T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("resolveSource", () => {
  it("returns google_pay for Google Wallet package", () => {
    expect(resolveSource("com.google.android.apps.walletnfcrel")).toBe("google_pay");
  });

  it("returns notification_android for Bancolombia package", () => {
    expect(resolveSource("com.todo1.mobile.co.bancolombia")).toBe("notification_android");
  });

  it("returns notification_android for any other package", () => {
    expect(resolveSource("com.nequi.MobileApp")).toBe("notification_android");
  });
});

describe("KNOWN_BANK_PACKAGES", () => {
  it("has 6 entries", () => {
    expect(KNOWN_BANK_PACKAGES).toHaveLength(6);
  });

  it("each entry has packageName and label", () => {
    KNOWN_BANK_PACKAGES.forEach((entry) => {
      expect(entry.packageName).toBeDefined();
      expect(typeof entry.packageName).toBe("string");
      expect(entry.label).toBeDefined();
      expect(typeof entry.label).toBe("string");
    });
  });
});
