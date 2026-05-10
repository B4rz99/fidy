import { useState } from "react";
import { useSubscription } from "./use-subscription";

const getMsUntilTomorrow = (now: Date): number => {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
};

export function useCurrentDate(): Date {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useSubscription(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleNextTick = () => {
      timeout = setTimeout(() => {
        setCurrentDate(new Date());
        scheduleNextTick();
      }, getMsUntilTomorrow(new Date()));
    };

    scheduleNextTick();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return currentDate;
}
