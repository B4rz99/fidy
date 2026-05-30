import { Card } from "@/shared/components";
import type { LucideIcon } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type BackupStatusCardProps = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
  readonly tone?: "green" | "peach";
};

export function BackupStatusCard({
  icon: Icon,
  title,
  body,
  tone = "green",
}: BackupStatusCardProps) {
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const iconColor = tone === "green" ? accentGreen : "#C46A2B";
  const iconBackground = tone === "green" ? "bg-accent-green-light" : "bg-peach-light";
  return (
    <Card style={{ borderWidth: 1, borderColor, gap: 10 }}>
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <View className={iconBackground} style={{ borderRadius: 12, padding: 8 }}>
          <Icon size={20} color={iconColor} />
        </View>
        <View className="flex-1" style={{ gap: 4 }}>
          <Text className="font-poppins-semibold text-primary dark:text-primary-dark">{title}</Text>
          <Text className="font-poppins text-xs text-secondary dark:text-secondary-dark">
            {body}
          </Text>
        </View>
      </View>
    </Card>
  );
}
