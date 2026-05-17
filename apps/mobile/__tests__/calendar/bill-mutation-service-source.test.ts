import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const serviceSource = readSource("../../features/calendar/lib/bill-mutation-service.ts");
const paymentCommitSource = readSource(
  "../../features/calendar/lib/bill-mutation-service/commit-bill-payment.ts"
);
const notificationsSource = readSource(
  "../../features/calendar/lib/bill-mutation-service/notifications.ts"
);
const updateFieldsSource = readSource(
  "../../features/calendar/lib/bill-mutation-service/to-bill-update-fields.ts"
);

test("keeps bill mutation service routed through extracted helpers", () => {
  expect(serviceSource).toContain("commitBillPaymentSafely");
  expect(serviceSource).toContain("applyBillPaymentSideEffects");
  expect(serviceSource).toContain("scheduleNotifications");
  expect(serviceSource).toContain("toBillUpdateFields");
});

test("keeps payment commit logic delegated to the Local Ledger payment recorder", () => {
  expect(paymentCommitSource).toContain("recordBillPayment");
  expect(paymentCommitSource).not.toContain("buildDefaultFinancialAccountId");
  expect(paymentCommitSource).not.toContain("toTransactionRow(transaction)");
});

test("keeps notification and update-field helpers as the side-effect and normalization seams", () => {
  expect(notificationsSource).toContain("requestNotificationPermissions");
  expect(notificationsSource).toContain("scheduleBillNotifications");
  expect(updateFieldsSource).toContain("assertCopAmount");
  expect(updateFieldsSource).toContain("fields.startDate.toISOString()");
});
