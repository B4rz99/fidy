import type { LucideIcon } from "lucide-react-native";
import { Home, Menu, Sparkles, Wallet } from "lucide-react-native";

export const TAB_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: Home, label: "HOME" },
  ai: { icon: Sparkles, label: "AI" },
  wallet: { icon: Wallet, label: "WALLET" },
  menu: { icon: Menu, label: "MENU" },
};
