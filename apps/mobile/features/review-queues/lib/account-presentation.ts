import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import {
  CreditCard,
  Landmark,
  type LucideIcon,
  PiggyBank,
  Wallet,
} from "@/shared/components/icons";

export function getFinancialAccountKindIcon(kind: string): LucideIcon {
  const resolvedKind = readFinancialAccountKind(kind);

  if (resolvedKind === "credit_card") {
    return CreditCard;
  }

  if (resolvedKind === "wallet" || resolvedKind === "cash") {
    return Wallet;
  }

  if (resolvedKind === "savings") {
    return PiggyBank;
  }

  return Landmark;
}
