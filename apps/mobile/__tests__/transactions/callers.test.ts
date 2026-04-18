import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const editTransactionSource = readFileSync(
  resolve(__dirname, "../../app/edit-transaction.tsx"),
  "utf-8"
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
});
