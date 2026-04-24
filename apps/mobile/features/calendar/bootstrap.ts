import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { initializeCalendarSession, loadBills, loadPaymentsForMonth } from "./public";

export const calendarBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "calendar",
  run: ({ db, userId }) => {
    initializeCalendarSession(userId);
    void Promise.all([loadBills(db, userId), loadPaymentsForMonth(db)]).catch(
      handleRecoverableError("Failed to load calendar data")
    );
  },
};
