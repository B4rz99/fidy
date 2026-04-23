import type { Bill } from "../../schema";
import type { CreateCalendarBillMutationServiceDeps } from "./types";

export function scheduleNotifications(deps: CreateCalendarBillMutationServiceDeps, bill: Bill) {
  void deps
    .requestNotificationPermissions()
    .then((granted) =>
      granted ? Promise.resolve(deps.scheduleBillNotifications(bill)) : undefined
    )
    .catch(deps.reportAsyncError);
}
