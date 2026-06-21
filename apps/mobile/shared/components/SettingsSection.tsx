import type { ReactNode } from "react";
import { Text, View } from "@/shared/components/rn";
import { SolidSurface } from "./SolidSurface";

type SettingsSectionProps = {
  label: string;
  children: ReactNode;
};

export function SettingsSection({ label, children }: SettingsSectionProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        className="font-poppins-semibold text-tertiary dark:text-tertiary-dark"
        style={{ fontSize: 12, letterSpacing: 0.5 }}
      >
        {label}
      </Text>
      <SolidSurface padded={false}>{children}</SolidSurface>
    </View>
  );
}
