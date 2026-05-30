import { useRouter } from "expo-router";
import { IconActionButton } from "@/shared/components/IconActionButton";
import { Search } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export const SearchAction = () => {
  const { push } = useRouter();
  const { t } = useTranslation();
  const iconColor = useThemeColor("primary");

  return (
    <IconActionButton
      accessibilityLabel={t("search.title")}
      icon={<Search size={22} color={iconColor} />}
      onPress={() => push("/search" as never)}
    />
  );
};
