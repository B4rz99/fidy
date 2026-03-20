import { Stack, useRouter, useSegments } from "expo-router";
import { useCallback } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { useTranslation } from "@/shared/hooks";

function SegmentControl() {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === "dark" ? "dark" : "light"];

  // Within (finance), segments look like ["(tabs)", "(finance)", "goals"] or ["(tabs)", "(finance)"]
  const isGoals = (segments as string[]).includes("goals");

  const goToBudgets = useCallback(() => {
    if (isGoals) router.replace("/(tabs)/(finance)" as never);
  }, [isGoals, router]);

  const goToGoals = useCallback(() => {
    if (!isGoals) router.replace("/(tabs)/(finance)/goals" as never);
  }, [isGoals, router]);

  return (
    <View style={[styles.segmentContainer, { backgroundColor: theme.card }]}>
      <Pressable
        style={[styles.segmentButton, !isGoals ? { backgroundColor: theme.accentGreen } : undefined]}
        onPress={goToBudgets}
      >
        <Text
          style={[
            styles.segmentText,
            { color: !isGoals ? "#FFFFFF" : theme.secondary },
          ]}
        >
          {t("budgets.title")}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.segmentButton, isGoals ? { backgroundColor: theme.accentGreen } : undefined]}
        onPress={goToGoals}
      >
        <Text
          style={[
            styles.segmentText,
            { color: isGoals ? "#FFFFFF" : theme.secondary },
          ]}
        >
          {t("goals.title")}
        </Text>
      </Pressable>
    </View>
  );
}

export default function FinanceStackLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === "dark" ? "dark" : "light"];
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {Platform.OS === "ios" ? (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.page },
            headerTintColor: theme.primary,
            headerTitle: () => <SegmentControl />,
          }}
        />
      ) : (
        <>
          <View style={[styles.androidHeader, { backgroundColor: theme.page }]}>
            <Text style={[styles.androidTitle, { color: theme.primary }]}>
              {t("tabs.finance")}
            </Text>
            <SegmentControl />
          </View>
          <Stack screenOptions={{ headerShown: false }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    width: 220,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    height: 32,
  },
  segmentText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  androidHeader: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    alignItems: "center",
  },
  androidTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
});
