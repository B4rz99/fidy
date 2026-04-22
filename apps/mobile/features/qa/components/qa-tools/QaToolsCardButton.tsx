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
  const borderSubtle = useThemeColor("borderSubtle");
  const card = useThemeColor("card");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  return (
    <Pressable
      onPress={onPress}
      testID={testId}
      style={[
        styles.cardButton,
        scenario ? styles.scenarioButton : undefined,
        {
          borderColor: highlighted ? accentGreen : borderSubtle,
          backgroundColor: highlighted ? accentGreenLight : card,
        },
      ]}
    >
      <Text style={[styles.cardTitle, { color: primary }]}>{title}</Text>
      {description ? (
        <Text style={[styles.cardDescription, { color: secondary }]}>{description}</Text>
      ) : null}
      {statusLabel ? (
        <Text style={[styles.statusLabelText, { color: primary }]}>{statusLabel}</Text>
      ) : null}
    </Pressable>
  );
}
