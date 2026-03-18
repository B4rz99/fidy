import type { LucideIcon } from "@/shared/components/icons";
import { Home, Settings, Sparkles, Wallet } from "@/shared/components/icons";

export const TAB_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: Home, label: "HOME" },
  ai: { icon: Sparkles, label: "AI" },
  budgets: { icon: Wallet, label: "BUDGETS" },
  menu: { icon: Settings, label: "MORE" },
};
