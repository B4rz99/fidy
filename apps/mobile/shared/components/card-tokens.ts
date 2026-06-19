type GlassCardTokens = {
  readonly tintColor: string;
};

const GLASS_CARD_TOKENS: Record<"light" | "dark", GlassCardTokens> = {
  light: {
    tintColor: "rgba(255, 255, 255, 0.06)",
  },
  dark: {
    tintColor: "rgba(28, 28, 30, 0.18)",
  },
};

export function getSubtleGlassCardTokens(isDark: boolean): GlassCardTokens {
  return isDark ? GLASS_CARD_TOKENS.dark : GLASS_CARD_TOKENS.light;
}

export type { GlassCardTokens };
