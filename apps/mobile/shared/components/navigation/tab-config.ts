import type { LucideIcon } from "@/shared/components/icons";
import { Home, Sparkles, Wallet } from "@/shared/components/icons";

export const TAB_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  "(index)": { icon: Home, label: "HOME" },
  "(ai)": { icon: Sparkles, label: "AI" },
  "(budget)": { icon: Wallet, label: "BUDGET" },
  "(finance)": { icon: Wallet, label: "FINANCE" },
};
