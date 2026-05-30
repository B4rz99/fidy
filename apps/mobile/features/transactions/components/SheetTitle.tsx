import type { ReactNode } from "react";
import { Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

export function SheetTitle({ children }: { readonly children: ReactNode }) {
  const primary = useThemeColor("primary");

  return (
    <Text style={{ color: primary, fontFamily: "Poppins_700Bold", fontSize: 22 }}>{children}</Text>
  );
}
