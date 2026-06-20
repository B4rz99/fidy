export const CATEGORY_BAR_BACKGROUND_COLORS: Record<string, string> = {
  clothing: "#D8E2EF",
  education: "#82BFE8",
  entertainment: "#CBB7E8",
  food: "#C4D6A4",
  health: "#BFEAD8",
  home: "#A6D6F5",
  other: "#D6C5EF",
  services: "#F6BD6C",
  transport: "#F4B2A3",
};

export const DARK_CATEGORY_BACKGROUND_COLOR = "#2B2F33";

export function getCategoryBarBackgroundColor(categoryId: string, fallbackColor: string): string {
  return CATEGORY_BAR_BACKGROUND_COLORS[categoryId] ?? fallbackColor;
}
