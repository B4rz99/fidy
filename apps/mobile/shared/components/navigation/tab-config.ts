import type { LucideIcon } from "lucide-react-native";
import { Calendar, Home, Menu, Sparkles } from "lucide-react-native";

export const TAB_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: Home, label: "HOME" },
  ai: { icon: Sparkles, label: "AI" },
  calendar: { icon: Calendar, label: "CALENDAR" },
  menu: { icon: Menu, label: "MENU" },
};
