import { describe, expect, it } from "vitest";
import { emailAccounts, processedEmails } from "@/shared/db/schema";
import { processedEmailStatusSchema } from "../../features/email-capture/schema";

describe("emailAccounts schema", () => {
  it("has required columns", () => {
    expect(emailAccounts.id).toBeDefined();
    expect(emailAccounts.userId).toBeDefined();
    expect(emailAccounts.provider).toBeDefined();
    expect(emailAccounts.email).toBeDefined();
    expect(emailAccounts.lastFetchedAt).toBeDefined();
    expect(emailAccounts.createdAt).toBeDefined();
  });
});

describe("processedEmailStatusSchema", () => {
  it("accepts needs_review status", () => {
    const result = processedEmailStatusSchema.safeParse("needs_review");
    expect(result.success).toBe(true);
  });

  it("still accepts existing statuses", () => {
    expect(processedEmailStatusSchema.safeParse("success").success).toBe(true);
    expect(processedEmailStatusSchema.safeParse("failed").success).toBe(true);
    expect(processedEmailStatusSchema.safeParse("skipped_duplicate").success).toBe(true);
  });
});

describe("processedEmails schema", () => {
  it("has required columns", () => {
    expect(processedEmails.id).toBeDefined();
    expect(processedEmails.externalId).toBeDefined();
    expect(processedEmails.provider).toBeDefined();
    expect(processedEmails.status).toBeDefined();
    expect(processedEmails.failureReason).toBeDefined();
    expect(processedEmails.subject).toBeDefined();
    expect(processedEmails.rawBodyPreview).toBeDefined();
    expect(processedEmails.receivedAt).toBeDefined();
    expect(processedEmails.transactionId).toBeDefined();
    expect(processedEmails.createdAt).toBeDefined();
  });
});
