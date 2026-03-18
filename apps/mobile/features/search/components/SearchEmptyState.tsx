import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type SearchEmptyStateProps = {
  onClearFilters: () => void;
};

export const SearchEmptyState = ({ onClearFilters }: SearchEmptyStateProps) => {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");

  return (
    <View className="items-center justify-center px-8 pt-16">
      <Text className="font-poppins-semibold text-body text-secondary dark:text-secondary-dark">
        {t("search.noResults")}
      </Text>
      <Pressable onPress={onClearFilters} className="mt-4">
        <Text className="font-poppins-semibold text-body" style={{ color: accentGreen }}>
          {t("search.clearFilters")}
        </Text>
      </Pressable>
    </View>
  );
};
