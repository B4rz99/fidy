import type { LucideIcon } from "lucide-react-native";
import { Car, Ellipsis, Receipt, ShoppingBag, TrendingUp, Utensils } from "lucide-react-native";
import { Colors } from "@/shared/constants/theme";

export type CategoryId = "food" | "transport" | "shopping" | "bills" | "income" | "other";

export type Category = {
  readonly id: CategoryId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly color: string;
};

export const CATEGORIES: readonly Category[] = [
  { id: "food", label: "Food", icon: Utensils, color: Colors.chart.food },
  { id: "transport", label: "Transport", icon: Car, color: Colors.chart.transport },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, color: Colors.chart.shopping },
  { id: "bills", label: "Bills", icon: Receipt, color: Colors.chart.bills },
  { id: "income", label: "Income", icon: TrendingUp, color: Colors.chart.income },
  { id: "other", label: "Other", icon: Ellipsis, color: Colors.chart.other },
] as const;

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;

export const CATEGORY_ROWS = [CATEGORIES.slice(0, 3), CATEGORIES.slice(3, 6)] as const;
export const CATEGORY_ROW_KEYS = CATEGORY_ROWS.map((row) => row.map((c) => c.id).join("-"));
