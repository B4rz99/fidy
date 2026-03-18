import { toIsoDate } from "@/shared/lib";

/** Monday-based start of week (avoids date-fns import in test-mocked environment). */
function mondayOfWeek(date: Date): Date {
  const day = date.getDay();
  // Sunday=0 → offset 6, Monday=1 → 0, Tuesday=2 → 1, etc.
  const offset = day === 0 ? 6 : day - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

export type DatePreset = {
  readonly key: string;
  readonly labelKey: string;
  readonly getRange: (today: Date) => { from: string; to: string };
};

export const DATE_PRESETS: readonly DatePreset[] = [
  {
    key: "today",
    labelKey: "search.today",
    getRange: (today) => {
      const iso = toIsoDate(today);
      return { from: iso, to: iso };
    },
  },
  {
    key: "thisWeek",
    labelKey: "search.thisWeek",
    getRange: (today) => ({
      from: toIsoDate(mondayOfWeek(today)),
      to: toIsoDate(today),
    }),
  },
  {
    key: "thisMonth",
    labelKey: "search.thisMonth",
    getRange: (today) => ({
      from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: toIsoDate(today),
    }),
  },
  {
    key: "lastMonth",
    labelKey: "search.lastMonth",
    getRange: (today) => {
      const firstOfCurrent = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastOfPrev = new Date(firstOfCurrent.getTime() - 1);
      const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
      return { from: toIsoDate(firstOfPrev), to: toIsoDate(lastOfPrev) };
    },
  },
];

export function getDatePresetRange(key: string, today: Date): { from: string; to: string } | null {
  const preset = DATE_PRESETS.find((p) => p.key === key);
  return preset ? preset.getRange(today) : null;
}
