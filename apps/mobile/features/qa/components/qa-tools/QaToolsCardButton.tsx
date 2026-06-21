import { SurfacePressable } from "@/shared/components";
import { Text } from "@/shared/components/rn";
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

  return (
    <SurfacePressable
      onPress={onPress}
      testID={testId}
      radius={scenario ? 18 : 16}
      accessibilityState={{ selected: highlighted }}
      layoutStyle={[styles.cardButton, scenario ? styles.scenarioButton : undefined]}
    >
      <Text style={[styles.cardTitle, { color: primary }]}>{title}</Text>
      {description ? (
        <Text style={[styles.cardDescription, { color: secondary }]}>{description}</Text>
      ) : null}
      {statusLabel ? (
        <Text style={[styles.statusLabelText, { color: primary }]}>{statusLabel}</Text>
      ) : null}
    </SurfacePressable>
  );
}
