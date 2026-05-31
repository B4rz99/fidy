import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import {
  Button,
  EmptyState,
  IconActionButton,
  ScreenLayout,
  TAB_BAR_CLEARANCE,
} from "@/shared/components";
import { Plus, Target } from "@/shared/components/icons";
import { Platform, StyleSheet, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { selectGoal, useGoalStore } from "../store";
import { GoalCard } from "./GoalCard";

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function GoalsEmpty({ onCreateGoal }: { readonly onCreateGoal: () => void }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");

  return (
    <EmptyState
      title={t("goals.empty.title")}
      subtitle={t("goals.empty.subtitle")}
      icon={
        <View className="size-[72px] items-center justify-center rounded-full bg-white/40">
          <Target size={36} color={accentGreen} />
        </View>
      }
      className="px-8"
      action={
        <View className="mt-6 self-stretch">
          <Button label={t("goals.empty.createGoal")} onPress={onCreateGoal} />
        </View>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Header add button
// ---------------------------------------------------------------------------

function AddGoalButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  return (
    <IconActionButton
      accessibilityLabel={t("goals.empty.createGoal")}
      icon={<Plus size={24} color={accentGreen} />}
      onPress={onPress}
    />
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function GoalsListScreen() {
  const { push } = useRouter();
  const { t } = useTranslation();
  const goals = useGoalStore((s) => s.goals);
  const isLoading = useGoalStore((s) => s.isLoading);
  const userId = useOptionalUserId();

  const handleCreateGoal = useCallback(() => {
    push("/create-goal");
  }, [push]);

  const handleGoalPress = useCallback(
    (goalId: string) => {
      if (!userId) return;
      const db = tryGetDb(userId);
      if (!db) return;
      void selectGoal(db, userId, goalId);
      push("/goal-detail");
    },
    [push, userId]
  );

  const handleAddPayment = useCallback(
    (goalId: string) => {
      if (!userId) return;
      const db = tryGetDb(userId);
      if (!db) return;
      void selectGoal(db, userId, goalId);
      push("/add-payment");
    },
    [push, userId]
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
        <FlashList
          data={goals}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          ItemSeparatorComponent={GoalItemSeparator}
        />
      )}
    </ScreenLayout>
  );
}

const GoalItemSeparator = () => <View style={styles.itemSeparator} />;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  itemSeparator: {
    height: 12,
  },
});
