import type { LucideIcon } from "@/shared/components/icons";
import { Calendar, Home, Settings, Sparkles } from "@/shared/components/icons";

export const TAB_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: Home, label: "HOME" },
  ai: { icon: Sparkles, label: "AI" },
  calendar: { icon: Calendar, label: "CALENDAR" },
  menu: { icon: Settings, label: "MORE" },
};
