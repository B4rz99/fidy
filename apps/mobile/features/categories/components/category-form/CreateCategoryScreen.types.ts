export type CreateCategoryScreenViewModel = {
  readonly canSubmit: boolean;
  readonly handleCreate: () => void;
  readonly handleIconSelect: (iconName: string) => void;
  readonly handleColorSelect: (color: string) => void;
  readonly isBusy: boolean;
  readonly name: string;
  readonly previewIcon: string;
  readonly selectedColor: string | null;
  readonly selectedIcon: string | null;
  readonly setName: (name: string) => void;
  readonly trimmedName: string;
};

export type CreateCategoryDraft = Pick<
  CreateCategoryScreenViewModel,
  | "canSubmit"
  | "handleColorSelect"
  | "handleIconSelect"
  | "name"
  | "selectedColor"
  | "selectedIcon"
  | "setName"
  | "trimmedName"
>;
