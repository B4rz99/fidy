import {
  LOGO_COIN,
  LOGO_COLORS,
  LOGO_DOLLAR_PATH,
  LOGO_TEXT_PATH,
  LOGO_VIEWBOX,
} from "@fidy/assets";
import { useColorScheme } from "@/shared/hooks";
import Svg, { Circle, G, Path } from "react-native-svg";

interface FidyLogoProps {
  size?: "default" | "small";
}

const SIZE_MAP = {
  default: { width: 256, height: 107 },
  small: { width: 128, height: 53 },
} as const;

export function FidyLogo({ size = "default" }: FidyLogoProps) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? LOGO_COLORS.dark : LOGO_COLORS.light;
  const { width, height } = SIZE_MAP[size];

  return (
    <Svg
      viewBox={LOGO_VIEWBOX}
      width={width}
      height={height}
      accessibilityRole="image"
      accessibilityLabel="Fidy logo"
    >
      <Path d={LOGO_TEXT_PATH} fill={colors.text} />
      <G transform={`translate(0, ${LOGO_COIN.groupOffsetY})`}>
        <Circle
          cx={LOGO_COIN.cx}
          cy={LOGO_COIN.cy}
          r={LOGO_COIN.r}
          fill={colors.coinFill}
          stroke={colors.coinStroke}
          strokeWidth={LOGO_COIN.strokeWidth}
        />
        <Path d={LOGO_DOLLAR_PATH} fill={colors.dollar} />
      </G>
    </Svg>
  );
}
