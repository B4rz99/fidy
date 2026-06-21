import { useRouter } from "expo-router";
import { useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import type { Category } from "@/shared/categories";
import {
  Button,
  EmptyState,
  Row,
  ScreenLayout,
  SettingsSection,
  TAB_BAR_CLEARANCE,
} from "@/shared/components";
import { ChevronRight, Plus } from "@/shared/components/icons";
import { ScrollView, StyleSheet, Text } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n/locale-helpers";
import {
  resetCategoryColor,
  resetCategoryEmoji,
  updateCategoryAppearance,
  useCategoriesStore,
} from "../store";
import { CategoryEmojiDialog } from "./CategoryEmojiDialog";

// ─── Category row with custom icon color ────────────────────────────

type CategoryRowProps = {
  icon: string;
  label: string;
  color: string;
  isLast: boolean;
  onPress?: () => void;
};

function CategoryRow({ icon, label, color, isLast, onPress }: CategoryRowProps) {
  return (
    <Row
      title={label}
      leading={<Text style={[styles.categoryEmoji, { color }]}>{icon}</Text>}
      trailing={<ChevronRight size={18} color={color} />}
      onPress={onPress}
      isLast={isLast}
    />
  );
}

// ─── Main screen ────────────────────────────────────────────────────

export function CategoriesScreen() {
  const { back, push } = useRouter();
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [emojiDraft, setEmojiDraft] = useState("");
  const [colorDraft, setColorDraft] = useState<string | null>(null);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);

  const builtInCategories = useCategoriesStore((s) => s.builtIn);
  const customCategories = useCategoriesStore((s) => s.custom);

  const handleAddPress = () => {
    push("/create-category");
  };

  const handleCategoryPress = (category: Category) => {
    setEditingCategory(category);
    setEmojiDraft(category.icon);
    setColorDraft(category.color);
  };

  const clearAppearanceDraft = () => {
    setEditingCategory(null);
    setEmojiDraft("");
    setColorDraft(null);
  };

  const runAppearanceMutation = (mutation: () => Promise<boolean>) => {
    setIsSavingAppearance(true);
    void Promise.resolve()
      .then(mutation)
      .then((success) => {
        if (success) clearAppearanceDraft();
      })
      .catch(() => {
        // Leave the dialog open so the user can retry.
      })
      .then(() => {
        setIsSavingAppearance(false);
      });
  };

  const handleCloseEmojiDialog = () => {
    if (isSavingAppearance) return;
    clearAppearanceDraft();
  };

  const handleSaveAppearance = () => {
    if (!editingCategory || !userId || colorDraft == null) return;
    runAppearanceMutation(() =>
      updateCategoryAppearance(getDb(userId), userId, {
        categoryId: editingCategory.id,
        emoji: emojiDraft,
        colorHex: colorDraft,
      })
    );
  };

  const handleResetEmoji = () => {
    if (!editingCategory || !userId) return;
    runAppearanceMutation(() => resetCategoryEmoji(getDb(userId), userId, editingCategory.id));
  };

  const handleResetColor = () => {
    if (!editingCategory || !userId) return;
    runAppearanceMutation(() => resetCategoryColor(getDb(userId), userId, editingCategory.id));
  };

  return (
    <ScreenLayout variant="sub" title={t("categories.title")} onBack={back}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Built-in categories */}
        <SettingsSection label={t("categories.builtInSection")}>
          {builtInCategories.map((category, index) => (
            <CategoryRow
              key={category.id}
              icon={category.icon}
              label={getCategoryLabel(category, locale)}
              color={category.color}
              onPress={() => handleCategoryPress(category)}
              isLast={index === builtInCategories.length - 1}
            />
          ))}
        </SettingsSection>

        {/* Custom categories */}
        <SettingsSection label={t("categories.customSection")}>
          {customCategories.length === 0 ? (
            <EmptyState
              title={t("categories.noCustomCategories")}
              className="min-h-20 flex-none p-4"
            />
          ) : (
            customCategories.map((category, index) => (
              <CategoryRow
                key={category.id}
                icon={category.icon}
                label={getCategoryLabel(category, locale)}
                color={category.color}
                onPress={() => handleCategoryPress(category)}
                isLast={index === customCategories.length - 1}
              />
            ))
          )}
        </SettingsSection>

        {/* Add category button */}
        <Button
          label={t("categories.addCategory")}
          variant="secondary"
          icon={<Plus size={20} />}
          onPress={handleAddPress}
        />
      </ScrollView>
      <CategoryEmojiDialog
        category={editingCategory}
        color={colorDraft}
        emoji={emojiDraft}
        isSaving={isSavingAppearance}
        onClose={handleCloseEmojiDialog}
        onColorChange={setColorDraft}
        onEmojiChange={setEmojiDraft}
        onResetColor={handleResetColor}
        onResetEmoji={handleResetEmoji}
        onSave={handleSaveAppearance}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 24 + TAB_BAR_CLEARANCE,
    gap: 24,
  },
  categoryEmoji: {
    fontSize: 24,
  },
});
