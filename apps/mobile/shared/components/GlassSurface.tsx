import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import { Platform, View } from "@/shared/components/rn";

type GlassSurfaceProps = ViewProps & {
  children: ReactNode;
  background?: "surface" | "card";
  className?: string;
  padded?: boolean;
};

export function GlassSurface({
  children,
  background = "surface",
  className,
  padded = true,
  style,
  ...viewProps
}: GlassSurfaceProps) {
  const backgroundClassName =
    background === "card" ? "bg-card dark:bg-card-dark" : "bg-surface dark:bg-surface-dark";
  const surfaceClassName = `rounded-2xl ${backgroundClassName} ${
    padded ? "p-4" : ""
  } ${className ?? ""}`;

  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView
        {...viewProps}
        glassEffectStyle="regular"
        className={surfaceClassName}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View {...viewProps} className={surfaceClassName} style={style}>
      {children}
    </View>
  );
}
