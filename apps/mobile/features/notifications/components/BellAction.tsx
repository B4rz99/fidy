import { useRouter } from "expo-router";
import { Bell } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { useNotificationStore } from "../store";

export const BellAction = () => {
  const { push } = useRouter();
  const iconColor = useThemeColor("primary");
  const accentRed = useThemeColor("accentRed");
  const newCount = useNotificationStore((s) => s.newCount);

  return (
    <Pressable
      onPress={() => push("/notifications" as never)}
      hitSlop={12}
      style={styles.container}
    >
      <Bell size={24} color={iconColor} />
      {newCount > 0 && (
        <View style={[styles.badge, { backgroundColor: accentRed }]}>
          <Text style={styles.badgeText}>{newCount > 99 ? "99+" : String(newCount)}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 9,
    color: "#FFFFFF",
  },
});
