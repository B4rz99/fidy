import { useState } from "react";
import type { UserId } from "@/shared/types/branded";
import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from "../../lib/constants";
import type { CreateCategoryDraft } from "./CreateCategoryScreen.types";

function hasValidDraft(input: {
  readonly selectedColor: string | null;
  readonly selectedIcon: string | null;
  readonly trimmedName: string;
  readonly userId: UserId | null | undefined;
}) {
  return (
    input.userId != null &&
    input.trimmedName.length >= MIN_NAME_LENGTH &&
    input.trimmedName.length <= MAX_NAME_LENGTH &&
    input.selectedIcon !== null &&
    input.selectedColor !== null
  );
}

export function useCreateCategoryDraft(userId: UserId | null | undefined): CreateCategoryDraft {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const trimmedName = name.trim();

  return {
    canSubmit: hasValidDraft({ selectedColor, selectedIcon, trimmedName, userId }),
    handleColorSelect: setSelectedColor,
    handleIconSelect: setSelectedIcon,
    name,
    selectedColor,
    selectedIcon,
    setName,
    trimmedName,
  };
}
