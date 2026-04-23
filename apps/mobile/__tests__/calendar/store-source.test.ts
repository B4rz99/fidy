import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const storeSource = readSource("../../features/calendar/store.ts");
const sessionSource = readSource("../../features/calendar/store/session.ts");
const mutationsSource = readSource("../../features/calendar/store/live-bill-mutations.ts");

test("keeps the calendar store routed through extracted session and mutation modules", () => {
  expect(storeSource).toContain("beginBillsLoadRequest");
  expect(storeSource).toContain("beginPaymentsLoadRequest");
  expect(storeSource).toContain("createLiveCalendarBillMutations");
  expect(storeSource).toContain('export { useCalendarStore } from "./store/state"');
});

test("keeps stale-request and session guards centralized in the session module", () => {
  expect(sessionSource).toContain("loadBillsRequestId");
  expect(sessionSource).toContain("loadPaymentsRequestId");
  expect(sessionSource).toContain("calendarSessionId");
  expect(sessionSource).toContain("applyMutationIfSessionIsActive");
});

test("keeps live calendar mutations wired to write-through and transaction cache updates", () => {
  expect(mutationsSource).toContain("createWriteThroughMutationModule");
  expect(mutationsSource).toContain("createCalendarBillMutationService");
  expect(mutationsSource).toContain("useTransactionStore.getState().addToCache");
  expect(mutationsSource).toContain("useTransactionStore.getState().removeFromCache");
});
