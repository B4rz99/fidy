import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import { View } from "@/shared/components/rn";

type CardProps = ViewProps & {
  children: ReactNode;
  padded?: boolean;
  className?: string;
};

export function Card({ children, padded = true, className, ...viewProps }: CardProps) {
  return (
    <View
      {...viewProps}
      className={`rounded-2xl bg-card dark:bg-card-dark ${padded ? "p-4" : ""} ${className ?? ""}`}
    >
      {children}
    </View>
  );
}
