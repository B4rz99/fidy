import { describe, expect, it } from "vitest";
import { emailAccounts, processedEmails } from "@/shared/db/schema";

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
