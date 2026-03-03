import type { LucideIcon } from "lucide-react-native";
import { Home, Menu, Sparkles, Target } from "lucide-react-native";

export const TAB_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: Home, label: "HOME" },
  ai: { icon: Sparkles, label: "AI" },
  goals: { icon: Target, label: "GOALS" },
  menu: { icon: Menu, label: "MENU" },
};
