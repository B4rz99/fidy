import { Platform, Text, useColorScheme, View } from "react-native";

interface FidyLogoProps {
  size?: "default" | "small";
}

export function FidyLogo({ size = "default" }: FidyLogoProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const isSmall = size === "small";
  const fontSize = isSmall ? 32 : 64;
  const coinSize = isSmall ? 8 : Platform.OS === "android" ? 15 : 14;
  const coinTop = Platform.OS === "android" ? (isSmall ? 3 : 8) : 0;
  const coinLeft = Platform.OS === "android" ? (isSmall ? 13 : 27) : isSmall ? 10 : 21;

  const textColor = isDark ? "#F0F0F0" : "#1A1A1A";
  const coinBg = isDark ? "#8BC34A" : "#7CB243";
  const coinStroke = isDark ? "#6EA038" : "#5A8C30";
  const dollarColor = isDark ? "#1A1A1A" : "#FFFFFF";

  return (
    <View style={{ position: "relative" }}>
      <Text
        style={{
          fontFamily: "Poppins_800ExtraBold",
          fontSize,
          color: textColor,
          lineHeight: fontSize * 1.2,
          ...(Platform.OS === "android" && { includeFontPadding: false }),
        }}
      >
        fidy
      </Text>
      <View
        style={{
          position: "absolute",
          top: coinTop,
          left: coinLeft,
          width: coinSize,
          height: coinSize,
          borderRadius: coinSize / 2,
          backgroundColor: coinBg,
          borderWidth: isSmall ? 1 : 1.5,
          borderColor: coinStroke,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: isSmall ? 4 : 7,
            color: dollarColor,
            lineHeight: isSmall ? 6 : 9,
            ...(Platform.OS === "android" && { includeFontPadding: false }),
          }}
        >
          $
        </Text>
      </View>
    </View>
  );
}
