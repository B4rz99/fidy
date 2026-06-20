import { Colors } from "@/shared/constants/theme";

const DARK_CHECK_COLOR = Colors.dark.onAccent;
const LIGHT_CHECK_COLOR = Colors.light.onAccent;
const HEX_COLOR_REGEX = /^#?([0-9A-Fa-f]{6})$/;

const parseHexChannel = (hex: string, start: number): number =>
  Number.parseInt(hex.slice(start, start + 2), 16);

const getPerceivedLuminance = (hex: string): number =>
  (0.299 * parseHexChannel(hex, 0) +
    0.587 * parseHexChannel(hex, 2) +
    0.114 * parseHexChannel(hex, 4)) /
  255;

export const getReadableSwatchCheckColor = (color: string): string => {
  const hex = HEX_COLOR_REGEX.exec(color)?.[1];
  if (!hex) return LIGHT_CHECK_COLOR;
  return getPerceivedLuminance(hex) > 0.62 ? DARK_CHECK_COLOR : LIGHT_CHECK_COLOR;
};
