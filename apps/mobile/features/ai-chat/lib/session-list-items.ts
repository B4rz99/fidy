import { format, isToday, isYesterday } from "date-fns";
import type { Locale } from "date-fns";
import type { ChatSession } from "../schema";

export type ChatSessionListItem =
  | { readonly type: "date"; readonly id: string; readonly label: string }
  | { readonly type: "session"; readonly session: ChatSession };

const getSessionDateBucket = (createdAt: ChatSession["createdAt"]) =>
  format(new Date(createdAt), "yyyy-MM-dd");

const getSessionDateLabel = (
  createdAt: ChatSession["createdAt"],
  locale: Locale,
  t: (key: string) => string
) => {
  const date = new Date(createdAt);
  if (isToday(date)) return t("dateGroups.today");
  if (isYesterday(date)) return t("dateGroups.yesterday");
  return format(date, "PP", { locale });
};

export const buildGroupedSessions = (
  sessions: readonly ChatSession[],
  locale: Locale,
  t: (key: string) => string
): ChatSessionListItem[] => {
  const items: ChatSessionListItem[] = [];
  let activeBucket: string | null = null;

  for (const session of sessions) {
    const bucket = getSessionDateBucket(session.createdAt);
    if (bucket !== activeBucket) {
      items.push({
        type: "date",
        id: `date-${bucket}`,
        label: getSessionDateLabel(session.createdAt, locale, t),
      });
      activeBucket = bucket;
    }
    items.push({ type: "session", session });
  }

  return items;
};
