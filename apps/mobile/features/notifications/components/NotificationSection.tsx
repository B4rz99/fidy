import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import type { NotificationSection as NotificationSectionType } from "../lib/types";
import { NotificationCard } from "./NotificationCard";

type NotificationSectionProps = {
  readonly section: NotificationSectionType;
  readonly onNotificationPress: (route: string) => void;
};

export const NotificationSection = ({ section, onNotificationPress }: NotificationSectionProps) => {
  const tertiaryColor = useThemeColor("tertiary");

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: tertiaryColor }]}>{section.label}</Text>
      <View style={styles.cards}>
        {section.notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onPress={onNotificationPress}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  cards: {
    gap: 12,
  },
});
