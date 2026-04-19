import {
  Car,
  Clapperboard,
  Ellipsis,
  GraduationCap,
  HeartPulse,
  House,
  type LucideIcon,
  Shirt,
  Utensils,
  Wrench,
} from "@/shared/components/icons";
import { Colors } from "@/shared/constants/theme";
import type { CategoryId } from "@/shared/types/branded";

export type Category = {
  readonly id: CategoryId;
  readonly label: { readonly en: string; readonly es: string };
  readonly icon: LucideIcon;
  readonly color: string;
};

export const CATEGORIES: readonly Category[] = [
  {
    id: "food" as CategoryId,
    label: { en: "Food", es: "Comida" },
    icon: Utensils,
    color: Colors.chart.food,
  },
  {
    id: "transport" as CategoryId,
    label: { en: "Transport", es: "Transporte" },
    icon: Car,
    color: Colors.chart.transport,
  },
  {
    id: "entertainment" as CategoryId,
    label: { en: "Entertainment", es: "Entretenimiento" },
    icon: Clapperboard,
    color: Colors.chart.entertainment,
  },
  {
    id: "health" as CategoryId,
    label: { en: "Health", es: "Salud" },
    icon: HeartPulse,
    color: Colors.chart.health,
  },
  {
    id: "education" as CategoryId,
    label: { en: "Education", es: "Educación" },
    icon: GraduationCap,
    color: Colors.chart.education,
  },
  {
    id: "home" as CategoryId,
    label: { en: "Home", es: "Hogar" },
    icon: House,
    color: Colors.chart.home,
  },
  {
    id: "clothing" as CategoryId,
    label: { en: "Clothing", es: "Ropa" },
    icon: Shirt,
    color: Colors.chart.clothing,
  },
  {
    id: "services" as CategoryId,
    label: { en: "Services", es: "Servicios" },
    icon: Wrench,
    color: Colors.chart.services,
  },
  {
    id: "other" as CategoryId,
    label: { en: "Other", es: "Otro" },
    icon: Ellipsis,
    color: Colors.chart.other,
  },
] as const;

export const CATEGORY_MAP: Record<string, Category | undefined> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);

export const getBuiltInCategory = (id: string): Category => {
  const category = CATEGORY_MAP[id];
  if (!category) {
    throw new Error(`Unknown built-in category: ${id}`);
  }
  return category;
};

export const getBuiltInCategoryId = (id: string): CategoryId => getBuiltInCategory(id).id;

export const DEFAULT_CATEGORY_IDS: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.id));

export const isValidCategoryId = (
  id: string,
  validIds: ReadonlySet<string> = DEFAULT_CATEGORY_IDS
): id is CategoryId => validIds.has(id);

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const CATEGORY_ROWS = [CATEGORIES.slice(0, 5), CATEGORIES.slice(5, 9)] as const;
export const CATEGORY_ROW_KEYS = CATEGORY_ROWS.map((row) => row.map((c) => c.id).join("-"));
