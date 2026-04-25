import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type StatusPillProps = {
  readonly label: string;
  readonly tone: "green" | "peach";
};

export function StatusPill({ label, tone }: StatusPillProps) {
  const accentGreen = useThemeColor("accentGreen");
  const textColor = tone === "green" ? accentGreen : "#C46A2B";
  return (
    <View
      className={tone === "green" ? "bg-accent-green-light" : "bg-peach-light"}
      style={{
        alignSelf: "flex-start",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text className="font-poppins-semibold" style={{ color: textColor, fontSize: 10 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
