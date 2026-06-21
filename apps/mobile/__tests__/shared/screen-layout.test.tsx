import { Platform, Text } from "react-native";
import { describe, expect, it } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { ScreenLayout, HEADER_HEIGHT, TAB_BAR_CLEARANCE } from "@/shared/components/ScreenLayout";

describe("ScreenLayout", () => {
  it("uses the native iOS header for default tab screens", () => {
    const screen = renderFidy(
      <ScreenLayout title="Financial accounts">
        <Text>Screen body</Text>
      </ScreenLayout>
    );

    expect(screen.queryByText("Financial accounts")).toBeNull();
    expect(screen.getByText("Screen body")).toBeTruthy();
  });

  it("renders a custom solid header for default sub screens", () => {
    const screen = renderFidy(
      <ScreenLayout title="Search" variant="sub">
        <Text>Search body</Text>
      </ScreenLayout>
    );

    expect(screen.getByText("Search")).toBeTruthy();
    expect(screen.getByText("Search body")).toBeTruthy();
  });

  it("renders an explicit title for custom sub screen headers", () => {
    const screen = renderFidy(
      <ScreenLayout title="Account details" variant="sub">
        <Text>Account body</Text>
      </ScreenLayout>
    );

    expect(screen.getByText("Account details")).toBeTruthy();
    expect(screen.getByText("Account body")).toBeTruthy();
  });

  it("gives tab centerAction precedence over the header title", () => {
    const screen = renderFidy(
      <ScreenLayout
        title="Financial accounts"
        leftAction={<Text>Add</Text>}
        centerAction={<Text>Month picker</Text>}
      >
        <Text>Screen body</Text>
      </ScreenLayout>
    );

    expect(screen.getByText("Month picker")).toBeTruthy();
    expect(screen.queryByText("Financial accounts")).toBeNull();
  });

  it("exports platform-aware layout constants", () => {
    expect(TAB_BAR_CLEARANCE).toBe(Platform.OS === "ios" ? 0 : 96);
    expect(HEADER_HEIGHT).toBe(48);
  });
});
