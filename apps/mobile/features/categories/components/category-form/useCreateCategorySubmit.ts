import { useCallback } from "react";
import { getDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import { createCustomCategory } from "../../store";

type CreateCategorySubmitArgs = {
  readonly guardedCreate: (operation: () => Promise<void>) => void;
  readonly onSuccess: () => void;
  readonly selectedColor: string | null;
  readonly selectedIcon: string | null;
  readonly trimmedName: string;
  readonly userId: UserId | null | undefined;
};

export function useCreateCategorySubmit(args: CreateCategorySubmitArgs) {
  return useCallback(() => {
    if (!args.selectedIcon || !args.selectedColor || !args.userId) return;
    const userId = args.userId;
    const selectedIcon = args.selectedIcon;
    const selectedColor = args.selectedColor;

    void args.guardedCreate(async () => {
      const success = await createCustomCategory(getDb(userId), userId, {
        name: args.trimmedName,
        iconName: selectedIcon,
        colorHex: selectedColor,
      });

      if (success) args.onSuccess();
    });
  }, [args]);
}
