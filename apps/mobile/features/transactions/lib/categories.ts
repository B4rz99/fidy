import type { LucideIcon } from "lucide-react-native";
import {
  ArrowLeftRight,
  Car,
  Clapperboard,
  Ellipsis,
  GraduationCap,
  HeartPulse,
  House,
  Shirt,
  Utensils,
  Wrench,
} from "lucide-react-native";
import { Colors } from "@/shared/constants/theme";

export type CategoryId =
  | "food"
  | "transport"
  | "entertainment"
  | "health"
  | "education"
  | "home"
  | "clothing"
  | "services"
  | "transfer"
  | "other";

export type Category = {
  readonly id: CategoryId;
  readonly label: { readonly en: string; readonly es: string };
  readonly icon: LucideIcon;
  readonly color: string;
};

export const CATEGORIES: readonly Category[] = [
  { id: "food", label: { en: "Food", es: "Comida" }, icon: Utensils, color: Colors.chart.food },
  {
    id: "transport",
    label: { en: "Transport", es: "Transporte" },
    icon: Car,
    color: Colors.chart.transport,
  },
  {
    id: "entertainment",
    label: { en: "Entertainment", es: "Entretenimiento" },
    icon: Clapperboard,
    color: Colors.chart.entertainment,
  },
  {
    id: "health",
    label: { en: "Health", es: "Salud" },
    icon: HeartPulse,
    color: Colors.chart.health,
  },
  {
    id: "education",
    label: { en: "Education", es: "Educación" },
    icon: GraduationCap,
    color: Colors.chart.education,
  },
  { id: "home", label: { en: "Home", es: "Hogar" }, icon: House, color: Colors.chart.home },
  {
    id: "clothing",
    label: { en: "Clothing", es: "Ropa" },
    icon: Shirt,
    color: Colors.chart.clothing,
  },
  {
    id: "services",
    label: { en: "Services", es: "Servicios" },
    icon: Wrench,
    color: Colors.chart.services,
  },
  {
    id: "transfer",
    label: { en: "Transfer", es: "Transferencia" },
    icon: ArrowLeftRight,
    color: Colors.chart.transfer,
  },
  { id: "other", label: { en: "Other", es: "Otro" }, icon: Ellipsis, color: Colors.chart.other },
] as const;

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const CATEGORY_ROWS = [CATEGORIES.slice(0, 5), CATEGORIES.slice(5, 10)] as const;
export const CATEGORY_ROW_KEYS = CATEGORY_ROWS.map((row) => row.map((c) => c.id).join("-"));
