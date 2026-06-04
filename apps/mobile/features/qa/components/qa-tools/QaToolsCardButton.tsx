import { GlassSurface } from "@/shared/components";
import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./QaTools.styles";

type QaToolsCardButtonProps = {
  readonly title: string;
  readonly description?: string;
  readonly statusLabel?: string;
  readonly highlighted?: boolean;
  readonly scenario?: boolean;
  readonly onPress: () => void;
  readonly testId?: string;
};

export function QaToolsCardButton({
  title,
  description,
  statusLabel,
  highlighted = false,
  scenario = false,
  onPress,
  testId,
}: QaToolsCardButtonProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  return (
    <Pressable onPress={onPress} testID={testId}>
      <GlassSurface
        padded={false}
        radius={16}
        style={[
          styles.cardButton,
          scenario ? styles.scenarioButton : undefined,
          highlighted ? { borderColor: accentGreen, backgroundColor: accentGreenLight } : null,
        ]}
      >
        <Text style={[styles.cardTitle, { color: primary }]}>{title}</Text>
        {description ? (
          <Text style={[styles.cardDescription, { color: secondary }]}>{description}</Text>
        ) : null}
        {statusLabel ? (
          <Text style={[styles.statusLabelText, { color: primary }]}>{statusLabel}</Text>
        ) : null}
      </GlassSurface>
    </Pressable>
  );
}
