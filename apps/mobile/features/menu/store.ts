import { create } from "zustand";

type MenuState = {
  isOpen: boolean;
};

type MenuActions = {
  openMenu: () => void;
  closeMenu: () => void;
};

export const useMenuStore = create<MenuState & MenuActions>((set) => ({
  isOpen: false,
  openMenu: () => set({ isOpen: true }),
  closeMenu: () => set({ isOpen: false }),
}));
