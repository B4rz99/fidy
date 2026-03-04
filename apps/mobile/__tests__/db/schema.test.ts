import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { transactions } from "@/shared/db/schema";

describe("transactions table schema", () => {
  it("is named 'transactions'", () => {
    expect(getTableName(transactions)).toBe("transactions");
  });

  it("has all required columns", () => {
    const cols = getTableColumns(transactions);
    const names = Object.keys(cols);

    expect(names).toContain("id");
    expect(names).toContain("type");
    expect(names).toContain("amountCents");
    expect(names).toContain("categoryId");
    expect(names).toContain("description");
    expect(names).toContain("date");
    expect(names).toContain("createdAt");
    expect(names).toHaveLength(7);
  });

  it("id is primary key", () => {
    const cols = getTableColumns(transactions);
    expect(cols.id.primary).toBe(true);
  });

  it("description is nullable", () => {
    const cols = getTableColumns(transactions);
    expect(cols.description.notNull).toBe(false);
  });

  it("amount_cents is not null", () => {
    const cols = getTableColumns(transactions);
    expect(cols.amountCents.notNull).toBe(true);
  });

  it("type is not null", () => {
    const cols = getTableColumns(transactions);
    expect(cols.type.notNull).toBe(true);
  });
});
