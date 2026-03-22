import { Bell } from "@/shared/components/icons";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export const NotificationFirstWeek = () => {
  const t = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  return (
    <View style={styles.container}>
      <View style={styles.spacer} />
      <View style={styles.content}>
        <View style={[styles.circle, { backgroundColor: accentGreenLight }]}>
          <Bell size={40} color={accentGreen} />
        </View>
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("notifications.firstWeekTitle")}
        </Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>
          {t("notifications.firstWeekMessage")}
        </Text>
      </View>
      <View style={styles.spacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    textAlign: "center",
    width: 260,
  },
});
