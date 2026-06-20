import { Surface } from "@/shared/components";
import { Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type StatusPillProps = {
  readonly label: string;
  readonly tone: "green" | "peach";
};

export function StatusPill({ label, tone }: StatusPillProps) {
  const accentGreen = useThemeColor("accentGreen");
  const warning = useThemeColor("warning");
  const textColor = tone === "green" ? accentGreen : warning;
  return (
    <Surface
      radius={12}
      padded={false}
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text className="font-poppins-semibold" style={{ color: textColor, fontSize: 12 }}>
        {label.toUpperCase()}
      </Text>
    </Surface>
  );
}
