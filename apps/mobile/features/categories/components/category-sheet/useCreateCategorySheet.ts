import { useRouter } from "expo-router";
import { useOptionalUserId } from "@/features/auth";
import { Ellipsis } from "@/shared/components/icons";
import { useAsyncGuard } from "@/shared/hooks";
import { ICON_MAP } from "../../lib/icon-map";
import type { CreateCategorySheetViewModel } from "./CreateCategorySheet.types";
import { useCreateCategoryDraft } from "./useCreateCategoryDraft";
import { useCreateCategorySubmit } from "./useCreateCategorySubmit";

function resolvePreviewIcon(selectedIcon: string | null) {
  return selectedIcon ? (ICON_MAP[selectedIcon] ?? Ellipsis) : Ellipsis;
}

export function useCreateCategorySheet(): CreateCategorySheetViewModel {
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
