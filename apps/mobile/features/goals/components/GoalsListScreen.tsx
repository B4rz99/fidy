import { useRouter } from "expo-router";
import { useOptionalUserId } from "@/features/auth/public";
import {
  Button,
  EmptyState,
  FeedList,
  AddActionButton,
  GlassSurface,
  ScreenLayout,
  TAB_BAR_CLEARANCE,
} from "@/shared/components";
import { Target } from "@/shared/components/icons";
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
        <GlassSurface
          radius={36}
          padded={false}
          className="size-[72px] items-center justify-center"
          style={{ alignItems: "center", height: 72, justifyContent: "center", width: 72 }}
        >
          <Target size={36} color={accentGreen} />
        </GlassSurface>
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
  return <AddActionButton accessibilityLabel={t("goals.empty.createGoal")} onPress={onPress} />;
}

const goalKeyExtractor = (item: { readonly goal: { readonly id: string } }) => item.goal.id;

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

type GoalsListScreenProps = {
  readonly includesHeader?: boolean;
};

export function GoalsListScreen({ includesHeader = true }: GoalsListScreenProps) {
  const { push } = useRouter();
  const { t } = useTranslation();
  const goals = useGoalStore((s) => s.goals);
  const isLoading = useGoalStore((s) => s.isLoading);
  const userId = useOptionalUserId();

  const handleCreateGoal = () => {
    push("/create-goal");
  };

  const handleGoalPress = (goalId: string) => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void selectGoal(db, userId, goalId);
    push("/goal-detail");
  };

  const handleAddPayment = (goalId: string) => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void selectGoal(db, userId, goalId);
    push("/add-payment");
  };

  const renderItem = ({ item }: { item: (typeof goals)[number] }) => (
    <GoalCard
      goalWithProgress={item}
      onPress={() => handleGoalPress(item.goal.id)}
      onAddPayment={() => handleAddPayment(item.goal.id)}
    />
  );

  const hasGoals = goals.length > 0;

  const content =
    !hasGoals && !isLoading ? (
      <GoalsEmpty onCreateGoal={handleCreateGoal} />
    ) : (
      <FeedList
        data={goals}
        renderItem={renderItem}
        keyExtractor={goalKeyExtractor}
        contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
        itemSeparatorHeight={12}
      />
    );

  if (!includesHeader) {
    return <View style={styles.embedded}>{content}</View>;
  }

  return (
    <ScreenLayout
      title={t("goals.title")}
      rightActions={
        hasGoals && Platform.OS !== "ios" ? <AddGoalButton onPress={handleCreateGoal} /> : undefined
      }
    >
      {content}
    </ScreenLayout>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  embedded: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
});
