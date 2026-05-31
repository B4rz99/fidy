type GlassCardTokens = {
  readonly fallbackBackgroundColor: string;
  readonly borderColor: string;
  readonly tintColor: string;
};

const GLASS_CARD_TOKENS: Record<"light" | "dark", GlassCardTokens> = {
  light: {
    fallbackBackgroundColor: "rgba(255, 255, 255, 0.20)",
    borderColor: "rgba(26, 26, 26, 0.08)",
    tintColor: "rgba(255, 255, 255, 0.18)",
  },
  dark: {
    fallbackBackgroundColor: "rgba(28, 28, 30, 0.26)",
    borderColor: "rgba(240, 240, 240, 0.08)",
    tintColor: "rgba(28, 28, 30, 0.18)",
  },
};

export function getSubtleGlassCardTokens(isDark: boolean): GlassCardTokens {
  return isDark ? GLASS_CARD_TOKENS.dark : GLASS_CARD_TOKENS.light;
}

export type { GlassCardTokens };
