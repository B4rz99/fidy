import { useState } from "react";
import { useSubscription } from "./use-subscription";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getMsUntilTomorrow = (now: Date): number => {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
};

export function useCurrentDate(): Date {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useSubscription(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      setCurrentDate(new Date());
      interval = setInterval(() => setCurrentDate(new Date()), MS_PER_DAY);
    }, getMsUntilTomorrow(new Date()));

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return currentDate;
}
