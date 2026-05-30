import type { ReactNode } from "react";
import { Button, Callout, EmptyState as SharedEmptyState, Row } from "@/shared/components";
import type { LucideIcon } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
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
  const accentGreen = useThemeColor("accentGreen");
  const warning = useThemeColor("warning");
  const iconColor = tone === "green" ? accentGreen : warning;

  return (
    <Callout
      title={title}
      subtitle={subtitle}
      tone={tone === "green" ? "success" : "warning"}
      icon={
        <View className="h-9 w-9 items-center justify-center rounded-icon bg-white/70">
          <Icon size={18} color={iconColor} />
        </View>
      }
    />
  );
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  return <SharedEmptyState title={title} subtitle={subtitle} />;
}

export function ActionButton({
  label,
  onPress,
  variant = "solid",
  disabled = false,
}: ActionButtonProps) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      variant={variant === "solid" ? "primary" : variant === "outline" ? "secondary" : "ghost"}
      size="compact"
      className="flex-1 px-2"
    />
  );
}

export function DetailRow({ label, title, subtitle, icon, emphasis = "neutral" }: DetailRowProps) {
  return (
    <Row
      title={
        <View style={{ gap: 2 }}>
          <Text className="font-poppins-bold text-[10px] uppercase text-text-secondary dark:text-text-secondary-dark">
            {label}
          </Text>
          <Text className="font-poppins-semibold text-label text-text-primary dark:text-text-primary-dark">
            {title}
          </Text>
        </View>
      }
      subtitle={subtitle}
      leading={<View className="w-9 items-center">{icon}</View>}
      className={`rounded-[18px] border border-border-subtle dark:border-border-subtle-dark ${
        emphasis === "green"
          ? "bg-accent-green-light dark:bg-accent-green-light-dark"
          : "bg-surface dark:bg-surface-dark"
      }`}
      divider={false}
    />
  );
}
