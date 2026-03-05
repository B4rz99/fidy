import { beforeEach, describe, expect, test } from "vitest";
import { useMenuStore } from "@/features/menu/store";

describe("useMenuStore", () => {
  beforeEach(() => {
    useMenuStore.setState({ isOpen: false });
  });

  test("starts closed", () => {
    expect(useMenuStore.getState().isOpen).toBe(false);
  });

  test("openMenu sets isOpen to true", () => {
    useMenuStore.getState().openMenu();
    expect(useMenuStore.getState().isOpen).toBe(true);
  });

  test("closeMenu sets isOpen to false", () => {
    useMenuStore.getState().openMenu();
    useMenuStore.getState().closeMenu();
    expect(useMenuStore.getState().isOpen).toBe(false);
  });

  test("openMenu is idempotent", () => {
    useMenuStore.getState().openMenu();
    useMenuStore.getState().openMenu();
    expect(useMenuStore.getState().isOpen).toBe(true);
  });

  test("closeMenu is idempotent when already closed", () => {
    useMenuStore.getState().closeMenu();
    expect(useMenuStore.getState().isOpen).toBe(false);
  });
});
