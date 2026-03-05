import { describe, expect, it } from "vitest";
import {
  emailProviderSchema,
  processedEmailStatusSchema,
  rawEmailSchema,
} from "@/features/email-capture/schema";

describe("email capture schemas", () => {
  it("validates a raw email", () => {
    const valid = rawEmailSchema.safeParse({
      externalId: "msg-123",
      from: "alertasynotificaciones@notificacionesbancolombia.com",
      subject: "Compra aprobada",
      body: "Su compra por $50,000 en EXITO fue aprobada",
      receivedAt: "2026-03-05T10:00:00Z",
      provider: "gmail",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid provider", () => {
    const invalid = rawEmailSchema.safeParse({
      externalId: "msg-123",
      from: "test@test.com",
      subject: "Test",
      body: "Body",
      receivedAt: "2026-03-05T10:00:00Z",
      provider: "yahoo",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates email provider", () => {
    expect(emailProviderSchema.safeParse("gmail").success).toBe(true);
    expect(emailProviderSchema.safeParse("outlook").success).toBe(true);
    expect(emailProviderSchema.safeParse("yahoo").success).toBe(false);
  });

  it("validates processed email status", () => {
    expect(processedEmailStatusSchema.safeParse("success").success).toBe(true);
    expect(processedEmailStatusSchema.safeParse("failed").success).toBe(true);
    expect(processedEmailStatusSchema.safeParse("skipped_duplicate").success).toBe(true);
    expect(processedEmailStatusSchema.safeParse("pending").success).toBe(false);
  });
});
