import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type NotificationEmptyStateProps = {
  readonly titleKey?: string;
};

export const NotificationEmptyState = ({
  titleKey = "notifications.emptyTitle",
}: NotificationEmptyStateProps) => {
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: primaryColor }]}>{t(titleKey)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
});
