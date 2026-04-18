import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useAuthStore } from "@/features/auth";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Plus, Target } from "@/shared/components/icons";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { UserId } from "@/shared/types/branded";
import { selectGoal, useGoalStore } from "../store";
import { GoalCard } from "./GoalCard";

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function GoalsEmpty({ onCreateGoal }: { readonly onCreateGoal: () => void }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.iconCircle, { backgroundColor: accentGreenLight }]}>
        <Target size={40} color={accentGreen} />
      </View>
      <Text style={[styles.emptyTitle, { color: primaryColor }]}>{t("goals.empty.title")}</Text>
      <Text style={[styles.emptySubtitle, { color: secondaryColor }]}>
        {t("goals.empty.subtitle")}
      </Text>
      <Pressable
        style={[styles.createButton, { backgroundColor: accentGreen }]}
        onPress={onCreateGoal}
      >
        <Text style={styles.createButtonText}>{t("goals.empty.createGoal")}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header add button
// ---------------------------------------------------------------------------

function AddGoalButton({ onPress }: { readonly onPress: () => void }) {
  const accentGreen = useThemeColor("accentGreen");
  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Plus size={24} color={accentGreen} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function GoalsListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const goals = useGoalStore((s) => s.goals);
  const isLoading = useGoalStore((s) => s.isLoading);
  const userId = useAuthStore((s) => s.session?.user.id ?? null) as UserId | null;

  const handleCreateGoal = useCallback(() => {
    router.push("/create-goal");
  }, [router]);

  const handleGoalPress = useCallback(
    (goalId: string) => {
      if (!userId) return;
      const db = tryGetDb(userId);
      if (!db) return;
      void selectGoal(db, userId, goalId);
      router.push("/goal-detail");
    },
    [router, userId]
  );

  const handleAddPayment = useCallback(
    (goalId: string) => {
      if (!userId) return;
      const db = tryGetDb(userId);
      if (!db) return;
      void selectGoal(db, userId, goalId);
      router.push("/add-payment");
    },
    [router, userId]
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof goals)[number] }) => (
      <GoalCard
        goalWithProgress={item}
        onPress={() => handleGoalPress(item.goal.id)}
        onAddPayment={() => handleAddPayment(item.goal.id)}
      />
    ),
    [handleGoalPress, handleAddPayment]
  );

  const keyExtractor = useCallback((item: (typeof goals)[number]) => item.goal.id, []);

  const hasGoals = goals.length > 0;

  return (
    <ScreenLayout
      title={t("goals.title")}
      rightActions={
        hasGoals && Platform.OS !== "ios" ? <AddGoalButton onPress={handleCreateGoal} /> : undefined
      }
    >
      {!hasGoals && !isLoading ? (
        <GoalsEmpty onCreateGoal={handleCreateGoal} />
      ) : (
        <FlatList
          data={goals}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </ScreenLayout>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
  },
  createButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    alignSelf: "stretch",
    minHeight: 48,
  },
  createButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
});
