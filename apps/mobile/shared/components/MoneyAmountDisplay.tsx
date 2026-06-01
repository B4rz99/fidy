import type { ComponentProps } from "react";
import Animated from "react-native-reanimated";
import {
  Pressable,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "@/shared/components/rn";
import { formatInputDisplay } from "@/shared/lib";

type MoneyAmountDisplaySize = "medium" | "large" | "hero";

export type MoneyAmountDisplayProps = {
  readonly accessibilityLabel?: string;
  readonly color: string;
  readonly cursorColor?: string;
  readonly cursorStyle?: ComponentProps<typeof Animated.View>["style"];
  readonly cursorVisible?: boolean;
  readonly digits: string;
  readonly emptyDisplay?: string;
  readonly onPress?: () => void;
  readonly rowStyle?: StyleProp<ViewStyle>;
  readonly size?: MoneyAmountDisplaySize;
  readonly textStyle?: StyleProp<TextStyle>;
};

const FONT_SIZE_BY_SIZE: Record<MoneyAmountDisplaySize, number> = {
  medium: 30,
  large: 32,
  hero: 40,
};

const CURSOR_HEIGHT_BY_SIZE: Record<MoneyAmountDisplaySize, number> = {
  medium: 28,
  large: 28,
  hero: 32,
};

export function MoneyAmountDisplay({
  accessibilityLabel,
  color,
  cursorColor = color,
  cursorStyle,
  cursorVisible = false,
  digits,
  emptyDisplay = "$",
  onPress,
  rowStyle,
  size = "large",
  textStyle,
}: MoneyAmountDisplayProps) {
  const displayAmount = digits.length > 0 ? formatInputDisplay(digits) : emptyDisplay;
  const content = (
    <View
      style={[
        {
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
        },
        rowStyle,
      ]}
    >
      <Text
        style={[
          {
            color,
            fontFamily: "Poppins_700Bold",
            fontSize: FONT_SIZE_BY_SIZE[size],
          },
          textStyle,
        ]}
      >
        {displayAmount}
      </Text>
      {cursorVisible ? (
        <Animated.View
          style={[
            {
              backgroundColor: cursorColor,
              borderRadius: 1,
              height: CURSOR_HEIGHT_BY_SIZE[size],
              marginLeft: 2,
              width: 2,
            },
            cursorStyle,
          ]}
        />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {content}
    </Pressable>
  );
}
