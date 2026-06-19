import * as Haptics from "expo-haptics";
import { memo } from "react";
import { Delete } from "@/shared/components/icons";
import { StyleSheet, Text, View, type ViewStyle } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { GlassPressable } from "./GlassPressable";
import { useNumpadGlassStyles } from "./use-numpad-glass-styles";

type FidyNumpadProps = {
  compact?: boolean;
  onKeyPress: (key: string) => void;
};

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["000", "0", "delete"],
] as const;

export const FidyNumpad = memo(({ compact = false, onKeyPress }: FidyNumpadProps) => {
  const { t } = useTranslation();
  const keyText = useThemeColor("primary");
  const specialText = useThemeColor("peach");
  const { keySurfaceStyle, specialKeySurfaceStyle } = useNumpadGlassStyles();

  const handlePress = (key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onKeyPress(key);
  };

  return (
    <View style={[styles.container, compact ? styles.compactContainer : undefined]}>
      {ROWS.map((row) => (
        <View key={row.join("-")} style={[styles.row, compact ? styles.compactRow : undefined]}>
          {row.map((key) => {
            const isSpecial = key === "000" || key === "delete";
            const keyStyle = [
              styles.key,
              compact ? styles.compactKey : undefined,
              isSpecial ? specialKeySurfaceStyle : keySurfaceStyle,
            ];
            const flattenedStyle = StyleSheet.flatten(keyStyle) as ViewStyle;
            const radius =
              typeof flattenedStyle?.borderRadius === "number" ? flattenedStyle.borderRadius : 14;
            return (
              <GlassPressable
                key={key}
                style={styles.keyLayout}
                surfaceLayoutStyle={styles.keySurface}
                radius={radius}
                padded={false}
                isInteractive
                onPress={() => handlePress(key)}
                accessibilityRole="button"
                accessibilityLabel={key === "delete" ? t("common.delete") : key}
              >
                {key === "delete" ? (
                  <Delete size={24} color={specialText} />
                ) : (
                  <Text
                    style={[
                      styles.keyLabel,
                      {
                        color: isSpecial ? specialText : keyText,
                        fontSize: key === "000" ? 18 : 22,
                      },
                    ]}
                  >
                    {key}
                  </Text>
                )}
              </GlassPressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

FidyNumpad.displayName = "FidyNumpad";

const styles = StyleSheet.create({
  container: {
    gap: 6,
    paddingTop: 8,
    paddingBottom: 8,
  },
  compactContainer: {
    gap: 6,
    paddingTop: 0,
    paddingBottom: 0,
  },
  row: {
    flexDirection: "row",
    gap: 6,
    height: 52,
  },
  compactRow: {
    gap: 6,
    height: 52,
  },
  key: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
  },
  keyLayout: {
    flex: 1,
    position: "relative",
  },
  keySurface: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  compactKey: {
    borderRadius: 10,
  },
  keyLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontWeight: "600",
  },
});
