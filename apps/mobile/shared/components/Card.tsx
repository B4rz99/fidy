import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import { GlassSurface } from "./GlassSurface";

type CardProps = ViewProps & {
  children: ReactNode;
  padded?: boolean;
  className?: string;
};

export function Card({ children, padded = true, className, ...viewProps }: CardProps) {
  return (
    <GlassSurface {...viewProps} padded={padded} className={className}>
      {children}
    </GlassSurface>
  );
}
