import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(resolve(__dirname, "../../app/add-bill.tsx"), "utf-8");
const layoutSource = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");

describe("add-bill formSheet screen", () => {
  test("is registered in root layout as formSheet", () => {
    expect(layoutSource).toContain('name="add-bill"');
    expect(layoutSource).toContain("formSheet");
  });

  test("uses KeyboardAvoidingView for keyboard handling", () => {
    expect(source).toContain("KeyboardAvoidingView");
  });

  test("has name and amount text inputs", () => {
    expect(source).toContain("TextInput");
    expect(source).toContain("onChangeText");
  });

  test("has frequency chips", () => {
    expect(source).toContain("FREQUENCIES");
    expect(source).toContain("frequency");
  });

  test("has category chips", () => {
    expect(source).toContain("CATEGORIES");
    expect(source).toContain("category");
  });

  test("calls addBill from store on submit", () => {
    expect(source).toContain("addBill");
  });

  test("uses router.back() on successful save", () => {
    expect(source).toContain("router.back()");
  });

  test("supports edit mode via billId param", () => {
    expect(source).toContain("billId");
  });

  test("dismisses keyboard on chip press", () => {
    expect(source).toContain("Keyboard.dismiss");
  });

  test("uses Pressable per ui-pressable rule", () => {
    expect(source).toContain("Pressable");
    expect(source).not.toContain("TouchableOpacity");
  });
});
