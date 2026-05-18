import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import { Platform, View } from "@/shared/components/rn";

type GlassSurfaceProps = ViewProps & {
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

export function GlassSurface({
  children,
  className,
  padded = true,
  style,
  ...viewProps
}: GlassSurfaceProps) {
  const surfaceClassName = `rounded-2xl bg-card dark:bg-card-dark ${
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
