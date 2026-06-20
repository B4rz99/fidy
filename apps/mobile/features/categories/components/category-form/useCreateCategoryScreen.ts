import { useRouter } from "expo-router";
import { useOptionalUserId } from "@/features/auth/public";
import { useAsyncGuard } from "@/shared/hooks";
import { resolveCategoryIconValue } from "../../lib/icon-map";
import type { CreateCategoryScreenViewModel } from "./CreateCategoryScreen.types";
import { useCreateCategoryDraft } from "./useCreateCategoryDraft";
import { useCreateCategorySubmit } from "./useCreateCategorySubmit";

function resolvePreviewIcon(selectedIcon: string | null) {
  return selectedIcon ? resolveCategoryIconValue(selectedIcon) : "✨";
}

export function useCreateCategoryScreen(): CreateCategoryScreenViewModel {
  const router = useRouter();
  const userId = useOptionalUserId();
  const { isBusy, run: guardedCreate } = useAsyncGuard();
  const draft = useCreateCategoryDraft(userId);
  const handleCreate = useCreateCategorySubmit({
    guardedCreate,
    onSuccess: () => router.back(),
    selectedColor: draft.selectedColor,
    selectedIcon: draft.selectedIcon,
    trimmedName: draft.trimmedName,
    userId,
  });

  return { ...draft, handleCreate, isBusy, previewIcon: resolvePreviewIcon(draft.selectedIcon) };
}
