import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
  Button,
  EmptyState,
  Row,
  ScreenLayout,
  SettingsSection,
  TAB_BAR_CLEARANCE,
} from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { ScrollView, StyleSheet, Text, useColorScheme } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n/locale-helpers";
import { useCategoriesStore } from "../store";

const CLOTHING_DARK_COLOR = "#E0E0E0";

/** Resolves icon color with dark-mode override for clothing (#1A1A1A -> #E0E0E0). */
const resolveIconColor = (color: string, isDark: boolean): string =>
  isDark && color === "#1A1A1A" ? CLOTHING_DARK_COLOR : color;

// ─── Category row with custom icon color ────────────────────────────

type CategoryRowProps = {
  icon: string;
  label: string;
  color: string;
  isLast: boolean;
};

function CategoryRow({ icon, label, color, isLast }: CategoryRowProps) {
  return (
    <Row
      title={label}
      leading={<Text style={[styles.categoryEmoji, { color }]}>{icon}</Text>}
      isLast={isLast}
    />
  );
}

// ─── Main screen ────────────────────────────────────────────────────

export function CategoriesScreen() {
  const { back, push } = useRouter();
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const builtInCategories = useCategoriesStore((s) => s.builtIn);
  const customCategories = useCategoriesStore((s) => s.custom);

  const handleAddPress = useCallback(() => {
    push("/create-category");
  }, [push]);

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
              color={resolveIconColor(category.color, isDark)}
              isLast={index === builtInCategories.length - 1}
            />
          ))}
        </SettingsSection>

        {/* Custom categories */}
        <SettingsSection label={t("categories.customSection")}>
          {customCategories.length === 0 ? (
            <EmptyState
              title={t("categories.noCustomCategories")}
              className="min-h-20 flex-none px-4 py-4"
            />
          ) : (
            customCategories.map((category, index) => (
              <CategoryRow
                key={category.id}
                icon={category.icon}
                label={getCategoryLabel(category, locale)}
                color={category.color}
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
