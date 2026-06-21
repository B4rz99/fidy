import type { Locale } from "date-fns";
import { format, isToday, isYesterday } from "date-fns";

type DateLabelInput = {
  readonly date: Date;
  readonly todayLabel?: string;
  readonly yesterdayLabel?: string;
  readonly dateFnsLocale?: Locale;
};

type RelativeDateLabel = {
  readonly matches: boolean;
  readonly label: string;
};

const makeRelativeDateLabels = ({
  date,
  todayLabel,
  yesterdayLabel,
}: {
  readonly date: Date;
  readonly todayLabel: string;
  readonly yesterdayLabel: string;
}): readonly RelativeDateLabel[] => [
  { matches: isToday(date), label: todayLabel },
  { matches: isYesterday(date), label: yesterdayLabel },
];

const makeDateFormatOptions = (dateFnsLocale: Locale | undefined) =>
  dateFnsLocale == null ? undefined : { locale: dateFnsLocale };

const resolveTodayLabel = (input: DateLabelInput): string => input.todayLabel ?? "Today";

const resolveYesterdayLabel = (input: DateLabelInput): string =>
  input.yesterdayLabel ?? "Yesterday";

const findRelativeDateLabel = (input: DateLabelInput): string | undefined =>
  makeRelativeDateLabels({
    date: input.date,
    todayLabel: resolveTodayLabel(input),
    yesterdayLabel: resolveYesterdayLabel(input),
  }).find(({ matches }) => matches)?.label;

const formatCalendarDate = (input: DateLabelInput): string =>
  format(input.date, "MMMM d", makeDateFormatOptions(input.dateFnsLocale));

export function makeDateLabel(input: DateLabelInput): string {
  return findRelativeDateLabel(input) ?? formatCalendarDate(input);
}
