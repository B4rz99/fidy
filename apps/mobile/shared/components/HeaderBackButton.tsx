import { router } from "expo-router";
import type { PressableProps } from "react-native";
import { ChevronLeft } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { IconActionButton } from "./IconActionButton";

type HeaderBackButtonProps = Partial<Pick<PressableProps, "onPress">>;

export function HeaderBackButton({ onPress }: HeaderBackButtonProps) {
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");

  return (
    <IconActionButton
      accessibilityLabel={t("common.back")}
      icon={<ChevronLeft size={24} color={primaryColor} />}
      onPress={onPress ?? router.back}
      size="size-11"
      tone="surface"
    />
  );
}
