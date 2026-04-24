import type { Category } from "@/shared/categories";
import { resolveLanguage } from "./resolve-language";

export const getCategoryLabel = (category: Category, locale: string): string =>
  resolveLanguage(locale) === "en" ? category.label.en : category.label.es;
