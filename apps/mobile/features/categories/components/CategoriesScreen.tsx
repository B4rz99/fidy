import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ScreenLayout, SettingsSection, TAB_BAR_CLEARANCE } from "@/shared/components";
import type { LucideIcon } from "@/shared/components/icons";
import { Plus } from "@/shared/components/icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n/locale-helpers";
import { useCategoriesStore } from "../store";

const CLOTHING_DARK_COLOR = "#E0E0E0";

/** Resolves icon color with dark-mode override for clothing (#1A1A1A -> #E0E0E0). */
const resolveIconColor = (color: string, isDark: boolean): string =>
  isDark && color === "#1A1A1A" ? CLOTHING_DARK_COLOR : color;

// ─── Category row with custom icon color ────────────────────────────

type CategoryRowProps = {
  icon: LucideIcon;
  label: string;
  color: string;
  isLast: boolean;
};

function CategoryRow({ icon: Icon, label, color, isLast }: CategoryRowProps) {
  const borderColor = useThemeColor("borderSubtle");

  return (
    <View
      style={[
        styles.categoryRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: borderColor,
        },
      ]}
    >
      <Icon size={24} color={color} />
      <Text
        className="font-poppins text-sm text-primary dark:text-primary-dark"
        style={{ flex: 1 }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────

export function CategoriesScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const accentGreen = useThemeColor("accentGreen");
  const cardBg = useThemeColor("card");

  const builtInCategories = useCategoriesStore((s) => s.builtIn);
  const customCategories = useCategoriesStore((s) => s.custom);

  const handleAddPress = useCallback(() => {
    router.push("/create-category");
  }, [router]);

  return (
    <ScreenLayout variant="sub" title={t("categories.title")} onBack={() => router.back()}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
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
            <View style={styles.emptyContainer}>
              <Text
                className="font-poppins-medium text-sm text-tertiary dark:text-tertiary-dark"
                style={styles.emptyText}
              >
                {t("categories.noCustomCategories")}
              </Text>
            </View>
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
        <Pressable onPress={handleAddPress} style={[styles.addButton, { backgroundColor: cardBg }]}>
          <Plus size={20} color={accentGreen} />
          <Text
            className="font-poppins-semibold"
            style={[styles.addButtonText, { color: accentGreen }]}
          >
            {t("categories.addCategory")}
          </Text>
        </Pressable>
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
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyContainer: {
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyText: {
    textAlign: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 16,
    gap: 6,
  },
  addButtonText: {
    fontSize: 15,
  },
});
