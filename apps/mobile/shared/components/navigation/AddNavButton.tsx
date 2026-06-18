import { AddActionButton } from "@/shared/components/AddActionButton";
import { useTranslation } from "@/shared/hooks";

type AddNavButtonProps = {
  onPress: () => void;
};

export const AddNavButton = ({ onPress }: AddNavButtonProps) => {
  const { t } = useTranslation();

  return (
    <AddActionButton
      onPress={onPress}
      accessibilityLabel={t("common.addTransaction")}
      iconSize={22}
      size={48}
    />
  );
};
