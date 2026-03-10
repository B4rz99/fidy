import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repoSource = readFileSync(
  resolve(__dirname, "../../features/calendar/lib/repository.ts"),
  "utf-8"
);

describe("calendar repository", () => {
  test("exports insertBill function", () => {
    expect(repoSource).toContain("export async function insertBill");
  });

  test("exports getAllBills function", () => {
    expect(repoSource).toContain("export async function getAllBills");
  });

  test("exports updateBill function", () => {
    expect(repoSource).toContain("export async function updateBill");
  });

  test("exports deleteBill function", () => {
    expect(repoSource).toContain("export async function deleteBill");
  });

  test("exports insertBillPayment function", () => {
    expect(repoSource).toContain("export async function insertBillPayment");
  });

  test("exports getBillPaymentsForMonth function", () => {
    expect(repoSource).toContain("export async function getBillPaymentsForMonth");
  });

  test("exports deleteBillPayment function", () => {
    expect(repoSource).toContain("export async function deleteBillPayment");
  });

  test("takes db as first parameter (dependency injection pattern)", () => {
    const fns = repoSource.match(/export async function \w+\(db: AnyDb/g);
    expect(fns).not.toBeNull();
    expect(fns?.length).toBeGreaterThanOrEqual(7);
  });

  test("uses drizzle query builders, not raw SQL", () => {
    expect(repoSource).not.toContain("db.run(");
    expect(repoSource).not.toContain("db.exec(");
  });

  test("imports bills and billPayments from schema", () => {
    expect(repoSource).toContain("bills");
    expect(repoSource).toContain("billPayments");
  });
});
