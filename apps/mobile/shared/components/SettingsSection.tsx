import type { ReactNode } from "react";
import { Text, View } from "@/shared/components/rn";

type SettingsSectionProps = {
  label: string;
  children: ReactNode;
};

export function SettingsSection({ label, children }: SettingsSectionProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        className="font-poppins-semibold text-tertiary dark:text-tertiary-dark"
        style={{ fontSize: 11, letterSpacing: 0.5 }}
      >
        {label}
      </Text>
      <View className="bg-card dark:bg-card-dark rounded-2xl overflow-hidden">{children}</View>
    </View>
  );
}
