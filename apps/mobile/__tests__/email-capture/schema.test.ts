import { describe, expect, it } from "vitest";
import { emailAccounts } from "@/shared/db/schema";

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
