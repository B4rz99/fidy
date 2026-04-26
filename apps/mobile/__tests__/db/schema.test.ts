import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { billPayments, bills, captureEvidence, transactions } from "@/shared/db/schema";

describe("transactions table schema", () => {
  it("is named 'transactions'", () => {
    expect(getTableName(transactions)).toBe("transactions");
  });

  it("has all required columns", () => {
    const cols = getTableColumns(transactions);
    const names = Object.keys(cols);

    expect(names).toContain("id");
    expect(names).toContain("userId");
    expect(names).toContain("type");
    expect(names).toContain("amount");
    expect(names).toContain("categoryId");
    expect(names).toContain("description");
    expect(names).toContain("date");
    expect(names).toContain("accountId");
    expect(names).toContain("accountAttributionState");
    expect(names).toContain("supersededAt");
    expect(names).toContain("createdAt");
    expect(names).toContain("updatedAt");
    expect(names).toContain("deletedAt");
    expect(names).toHaveLength(14);
  });

  it("id is primary key", () => {
    const cols = getTableColumns(transactions);
    expect(cols.id.primary).toBe(true);
  });

  it("description is nullable", () => {
    const cols = getTableColumns(transactions);
    expect(cols.description.notNull).toBe(false);
  });

  it("deletedAt is nullable (soft delete)", () => {
    const cols = getTableColumns(transactions);
    expect(cols.deletedAt.notNull).toBe(false);
  });

  it("userId is not null", () => {
    const cols = getTableColumns(transactions);
    expect(cols.userId.notNull).toBe(true);
  });

  it("accountId is not null", () => {
    const cols = getTableColumns(transactions);
    expect(cols.accountId.notNull).toBe(true);
  });

  it("accountAttributionState is not null", () => {
    const cols = getTableColumns(transactions);
    expect(cols.accountAttributionState.notNull).toBe(true);
  });

  it("supersededAt is nullable", () => {
    const cols = getTableColumns(transactions);
    expect(cols.supersededAt.notNull).toBe(false);
  });

  it("has source column", () => {
    expect(transactions.source).toBeDefined();
    expect(transactions.source.name).toBe("source");
  });
});

describe("captureEvidence table schema", () => {
  it("is named 'capture_evidence'", () => {
    expect(getTableName(captureEvidence)).toBe("capture_evidence");
  });

  it("has the normalized evidence columns", () => {
    const cols = getTableColumns(captureEvidence);
    const names = Object.keys(cols);

    expect(names).toContain("id");
    expect(names).toContain("userId");
    expect(names).toContain("sourceFamily");
    expect(names).toContain("evidenceType");
    expect(names).toContain("scope");
    expect(names).toContain("value");
    expect(names).toContain("transactionId");
    expect(names).toContain("transferId");
    expect(names).toContain("processedEmailId");
    expect(names).toContain("processedCaptureId");
    expect(names).toContain("createdAt");
    expect(names).toContain("updatedAt");
    expect(names).toContain("deletedAt");
    expect(names).toHaveLength(13);
  });

  it("requires userId, scope, and value", () => {
    const cols = getTableColumns(captureEvidence);

    expect(cols.userId.notNull).toBe(true);
    expect(cols.scope.notNull).toBe(true);
    expect(cols.value.notNull).toBe(true);
  });
});

describe("bills table schema", () => {
  it("is named 'bills'", () => {
    expect(getTableName(bills)).toBe("bills");
  });

  it("has all required columns", () => {
    const cols = getTableColumns(bills);
    const names = Object.keys(cols);

    expect(names).toContain("id");
    expect(names).toContain("userId");
    expect(names).toContain("name");
    expect(names).toContain("amount");
    expect(names).toContain("frequency");
    expect(names).toContain("categoryId");
    expect(names).toContain("startDate");
    expect(names).toContain("isActive");
    expect(names).toContain("createdAt");
    expect(names).toContain("updatedAt");
    expect(names).toHaveLength(10);
  });

  it("id is primary key", () => {
    const cols = getTableColumns(bills);
    expect(cols.id.primary).toBe(true);
  });

  it("userId is not null", () => {
    const cols = getTableColumns(bills);
    expect(cols.userId.notNull).toBe(true);
  });

  it("isActive defaults to true", () => {
    const cols = getTableColumns(bills);
    expect(cols.isActive.hasDefault).toBe(true);
  });
});

describe("billPayments table schema", () => {
  it("is named 'bill_payments'", () => {
    expect(getTableName(billPayments)).toBe("bill_payments");
  });

  it("has all required columns", () => {
    const cols = getTableColumns(billPayments);
    const names = Object.keys(cols);

    expect(names).toContain("id");
    expect(names).toContain("billId");
    expect(names).toContain("dueDate");
    expect(names).toContain("paidAt");
    expect(names).toContain("transactionId");
    expect(names).toContain("createdAt");
    expect(names).toHaveLength(6);
  });

  it("id is primary key", () => {
    const cols = getTableColumns(billPayments);
    expect(cols.id.primary).toBe(true);
  });

  it("billId is not null", () => {
    const cols = getTableColumns(billPayments);
    expect(cols.billId.notNull).toBe(true);
  });
});
