import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const editTransactionSource = readFileSync(
  resolve(__dirname, "../../app/edit-transaction.tsx"),
  "utf-8"
).replace(/\r\n/g, "\n");
const reclassifyTransactionRouteSource = readFileSync(
  resolve(__dirname, "../../app/reclassify-transaction.tsx"),
  "utf-8"
).replace(/\r\n/g, "\n");
const rootLayoutSource = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8").replace(
  /\r\n/g,
  "\n"
);

describe("transaction callers", () => {
  test("edit screen surfaces save and delete failures before navigating away when auth/db is missing", () => {
    expect(editTransactionSource).toContain(
      'if (transactionId == null || !db || !userId) {\n        showErrorToast(t("transactions.updateFailed"));'
    );
    expect(editTransactionSource).toContain(
      'if (transactionId == null || !db || !userId) {\n        showErrorToast(t("transactions.deleteFailed"));'
    );
  });

  test("edit screen reclassifies captured transactions by transaction id only", () => {
    expect(editTransactionSource).toContain('pathname: "/reclassify-transaction"');
    expect(editTransactionSource).toContain("transactionId,");
    expect(editTransactionSource).not.toContain("processedEmailId");
  });

  test("reclassification opens as a full screen transfer route", () => {
    expect(rootLayoutSource).toContain('name="reclassify-transaction"');
    const routeStart = rootLayoutSource.indexOf('name="reclassify-transaction"');
    const routeBlock = rootLayoutSource.slice(
      routeStart,
      rootLayoutSource.indexOf("/>", routeStart)
    );
    expect(routeBlock).toContain("screenLayoutRouteOptions");
    expect(reclassifyTransactionRouteSource).not.toContain("DialogRouteFrame");
    expect(reclassifyTransactionRouteSource).toContain("TransferFormScreen");
  });
});
