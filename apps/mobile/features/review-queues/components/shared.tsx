import type { ReactNode } from "react";
import type { LucideIcon } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type SummaryCardProps = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly subtitle: string;
  readonly tone?: "warning" | "green";
};

type EmptyStateProps = {
  readonly title: string;
  readonly subtitle: string;
};

type ActionButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: "solid" | "outline" | "ghost";
  readonly disabled?: boolean;
};

type DetailRowProps = {
  readonly label: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: ReactNode;
  readonly emphasis?: "neutral" | "green";
};

export function SummaryCard({ icon: Icon, title, subtitle, tone = "warning" }: SummaryCardProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  const backgroundColor = tone === "green" ? accentGreenLight : peachLight;
  const iconColor = tone === "green" ? accentGreen : "#E67E22";

  return (
    <View style={[styles.summaryCard, { backgroundColor }]}>
      <View style={[styles.summaryIconWrap, { backgroundColor: "#FFFFFFAA" }]}>
        <Icon size={18} color={iconColor} />
      </View>
      <View style={styles.summaryBody}>
        <Text style={[styles.summaryTitle, { color: primary }]}>{title}</Text>
        <Text style={[styles.summarySubtitle, { color: secondary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: primary }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: secondary }]}>{subtitle}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = "solid",
  disabled = false,
}: ActionButtonProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
  const peachLight = useThemeColor("peachLight");

  const buttonStyle = (() => {
    if (variant === "solid") return { backgroundColor: accentGreen, borderColor: accentGreen };
    if (variant === "outline") return { backgroundColor: card, borderColor: borderSubtle };
    return { backgroundColor: peachLight, borderColor: peachLight };
  })();
  const labelColor = (() => {
    if (variant === "solid") return onAccent;
    if (variant === "ghost") return secondary;
    return primary;
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionButton, buttonStyle, disabled ? styles.actionButtonDisabled : null]}
    >
      <Text style={[styles.actionButtonLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

export function DetailRow({ label, title, subtitle, icon, emphasis = "neutral" }: DetailRowProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreenLight = useThemeColor("accentGreenLight");

  return (
    <View
      style={[
        styles.detailRow,
        {
          backgroundColor: emphasis === "green" ? accentGreenLight : card,
          borderColor: borderSubtle,
        },
      ]}
    >
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailBody}>
        <Text style={[styles.detailLabel, { color: secondary }]}>{label}</Text>
        <Text style={[styles.detailTitle, { color: primary }]}>{title}</Text>
        <Text style={[styles.detailSubtitle, { color: secondary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBody: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    lineHeight: 20,
  },
  summarySubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 17,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionButtonLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
  detailRow: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIcon: {
    width: 36,
    alignItems: "center",
  },
  detailBody: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  detailTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  detailSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});
