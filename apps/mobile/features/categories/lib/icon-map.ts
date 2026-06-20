export const ICON_MAP: Record<string, string> = {
  ShoppingCart: "🛒",
  Heart: "❤️",
  House: "🏠",
  Car: "🚗",
  Plane: "✈️",
  Gift: "🎁",
  Book: "📚",
  Music: "🎵",
  Gamepad2: "🎮",
  Dog: "🐶",
  Dumbbell: "🏋️",
  Stethoscope: "🩺",
  GraduationCap: "🎓",
  Wrench: "🛠️",
  Baby: "👶",
  Coffee: "☕",
  Shirt: "👕",
  Sparkles: "✨",
  Monitor: "🖥️",
  Scissors: "✂️",
  Wallet: "👛",
  Umbrella: "☂️",
  Briefcase: "💼",
  PiggyBank: "🐷",
  Trophy: "🏆",
  Star: "⭐",
  Zap: "⚡",
  Wifi: "📶",
  Fuel: "⛽",
  Wine: "🍷",
  ShoppingBag: "🛍️",
  Building2: "🏢",
  PawPrint: "🐾",
  Smartphone: "📱",
  TrendingUp: "📈",
  Utensils: "🍽️",
};

export const SELECTABLE_ICONS: readonly { readonly name: string; readonly icon: string }[] =
  Object.entries(ICON_MAP).map(([name, icon]) => ({ name, icon }));

const EMOJI_FLAG_SEQUENCE = "(?:\\p{Regional_Indicator}{2})";
const EMOJI_KEYCAP_SEQUENCE = "(?:[0-9#*]\\uFE0F?\\u20E3)";
const EMOJI_BASE = "(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})";
const EMOJI_VARIANT = "(?:[\\uFE0E\\uFE0F]|\\p{Emoji_Modifier})?";
const EMOJI_SYMBOL_SEQUENCE = `${EMOJI_BASE}${EMOJI_VARIANT}(?:\\u200D${EMOJI_BASE}${EMOJI_VARIANT})*`;
const EMOJI_SEQUENCE_REGEX = new RegExp(
  `${EMOJI_FLAG_SEQUENCE}|${EMOJI_KEYCAP_SEQUENCE}|${EMOJI_SYMBOL_SEQUENCE}`,
  "u"
);

export function normalizeCategoryEmoji(emoji: string): string {
  return emoji.trim().match(EMOJI_SEQUENCE_REGEX)?.[0] ?? "";
}

export function isCategoryIconValue(value: string): boolean {
  return Object.hasOwn(ICON_MAP, value) || normalizeCategoryEmoji(value).length > 0;
}

export function resolveCategoryIconValue(value: string): string {
  return ICON_MAP[value] ?? (normalizeCategoryEmoji(value) || "✨");
}
