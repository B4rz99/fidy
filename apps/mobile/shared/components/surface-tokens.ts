type SurfaceTokens = {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly dividerColor: string;
};

const SURFACE_TOKENS: Record<"light" | "dark", SurfaceTokens> = {
  light: {
    backgroundColor: "#FFFFFF",
    borderColor: "#00000030",
    dividerColor: "#00000047",
  },
  dark: {
    backgroundColor: "#1C1C1E",
    borderColor: "#FFFFFF3D",
    dividerColor: "#FFFFFF59",
  },
};

export const SURFACE_SHADOW_COLOR = "#000000";

export function getSubtleSurfaceTokens(isDark: boolean): SurfaceTokens {
  return isDark ? SURFACE_TOKENS.dark : SURFACE_TOKENS.light;
}

export type { SurfaceTokens };
