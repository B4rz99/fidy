import type { LucideIcon } from "@/shared/components/icons";
import { StyleSheet, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassPressable } from "../GlassPressable";

type NavItemProps = {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onPress: () => void;
};

export function NavItem({ icon: Icon, label, isActive, onPress }: NavItemProps) {
  const accentGreen = useThemeColor("accentGreen");
  const tertiaryColor = useThemeColor("tertiary");

  return (
    <GlassPressable
      onPress={onPress}
      padded={false}
      radius={999}
      surfaceLayoutStyle={styles.surface}
    >
      <Icon size={18} color={isActive ? accentGreen : tertiaryColor} />
      <Text
        className={`font-poppins-semibold text-nav uppercase tracking-wider ${
          isActive ? "text-accent-green dark:text-accent-green-dark" : "text-tertiary"
        }`}
      >
        {label}
      </Text>
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
