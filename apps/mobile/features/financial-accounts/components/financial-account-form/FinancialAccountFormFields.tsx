import type { StyleProp, ViewStyle } from "react-native";
import {
  type FinancialAccountKind,
  financialAccountKindSchema,
} from "@/features/financial-accounts/schema";
import { getKindEmoji } from "@/features/financial-accounts/lib/kind-display";
import { SelectableChipRow } from "@/shared/components/SelectableChipRow";
import { useTranslation } from "@/shared/hooks";

const ACCOUNT_KIND_OPTIONS = financialAccountKindSchema.options;

export function FinancialAccountKindPicker({
  chipStyle,
  showEmoji = true,
  style,
  value,
  onChange,
}: {
  readonly chipStyle?: StyleProp<ViewStyle>;
  readonly showEmoji?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly value: FinancialAccountKind;
  readonly onChange: (kind: FinancialAccountKind) => void;
}) {
  const { t } = useTranslation();
  const options = ACCOUNT_KIND_OPTIONS.map((kind) => {
    const label = t(`financialAccounts.kinds.${kind}`);

    return {
      value: kind,
      label: showEmoji ? `${getKindEmoji(kind)} ${label}` : label,
    };
  });

  return (
    <SelectableChipRow
      options={options}
      value={value}
      onChange={onChange}
      selectedTone="primary"
      chipStyle={chipStyle}
      style={style}
    />
  );
}
