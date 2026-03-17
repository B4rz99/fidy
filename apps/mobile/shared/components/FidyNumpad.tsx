import * as Haptics from "expo-haptics";
import { Delete } from "@/shared/components/icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type FidyNumpadProps = {
  onKeyPress: (key: string) => void;
};

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["000", "0", "delete"],
] as const;

export const FidyNumpad = memo(({ onKeyPress }: FidyNumpadProps) => {
  const keyBg = useThemeColor("numpadKey");
  const specialKeyBg = useThemeColor("numpadSpecialKey");
  const keyText = useThemeColor("primary");
  const specialText = useThemeColor("peach");

  const handlePress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onKeyPress(key);
  };

  return (
    <View style={styles.container}>
      {ROWS.map((row) => (
        <View key={row.join("-")} style={styles.row}>
          {row.map((key) => {
            const isSpecial = key === "000" || key === "delete";
            return (
              <Pressable
                key={key}
                style={[styles.key, { backgroundColor: isSpecial ? specialKeyBg : keyBg }]}
                onPress={() => handlePress(key)}
                accessibilityRole="button"
                accessibilityLabel={key === "delete" ? "Delete" : key}
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
              </Pressable>
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
    paddingBottom: 0,
  },
  row: {
    flexDirection: "row",
    gap: 6,
    height: 42,
  },
  key: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  keyLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontWeight: "600",
  },
});
