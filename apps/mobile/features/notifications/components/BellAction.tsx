import { useRouter } from "expo-router";
import { IconActionButton } from "@/shared/components/IconActionButton";
import { Bell } from "@/shared/components/icons";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useNotificationStore } from "../store";

export const BellAction = () => {
  const { push } = useRouter();
  const { t } = useTranslation();
  const iconColor = useThemeColor("primary");
  const danger = useThemeColor("danger");
  const onAccent = useThemeColor("onAccent");
  const newCount = useNotificationStore((s) => s.newCount);
  const badgeLabel = newCount > 0 ? (newCount > 99 ? "99+" : String(newCount)) : undefined;

  return (
    <View style={styles.wrapper}>
      <IconActionButton
        accessibilityLabel={t("notifications.title")}
        icon={<Bell size={24} color={iconColor} />}
        onPress={() => push("/notifications" as never)}
      />
      {badgeLabel ? (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: danger }]}>
          <Text style={[styles.badgeText, { color: onAccent }]}>{badgeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  badge: {
    position: "absolute",
    right: 0,
    top: 0,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  badgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    lineHeight: 12,
  },
});
