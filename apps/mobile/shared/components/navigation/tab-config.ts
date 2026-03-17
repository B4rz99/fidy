import type { LucideIcon } from "@/shared/components/icons";
import { Calendar, Home, Menu, Sparkles } from "@/shared/components/icons";

export const TAB_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: Home, label: "HOME" },
  ai: { icon: Sparkles, label: "AI" },
  calendar: { icon: Calendar, label: "CALENDAR" },
  menu: { icon: Menu, label: "MENU" },
};
