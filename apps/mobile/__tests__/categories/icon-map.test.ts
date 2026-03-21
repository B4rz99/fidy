import { describe, expect, it } from "vitest";
import { ICON_MAP, SELECTABLE_ICONS } from "../../features/categories/lib/icon-map";

describe("icon-map", () => {
  it("SELECTABLE_ICONS has exactly 36 entries", () => {
    expect(SELECTABLE_ICONS).toHaveLength(36);
  });

  it("every entry in ICON_MAP maps to a non-null component", () => {
    for (const [name, icon] of Object.entries(ICON_MAP)) {
      expect(icon, `ICON_MAP["${name}"] is null/undefined`).toBeTruthy();
    }
  });

  it("SELECTABLE_ICONS entries each have a name and icon", () => {
    for (const entry of SELECTABLE_ICONS) {
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("icon");
      expect(typeof entry.name).toBe("string");
      expect(entry.icon).toBeTruthy();
    }
  });
});
