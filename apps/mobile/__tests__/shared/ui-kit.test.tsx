import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { Button } from "@/shared/components/Button";
import { Callout } from "@/shared/components/Callout";
import { Chip } from "@/shared/components/Chip";
import { EmptyState } from "@/shared/components/EmptyState";
import { Row } from "@/shared/components/Row";
import { Text } from "@/shared/components/rn";

describe("shared UI kit", () => {
  it("exports the first-wave primitives from the shared components barrel", () => {
    const source = readFileSync(resolve(__dirname, "../../shared/components/index.ts"), "utf-8");

    expect(source).toContain('export { Button } from "./Button"');
    expect(source).toContain('export { Card } from "./Card"');
    expect(source).toContain('export { Row } from "./Row"');
    expect(source).toContain('export { Chip } from "./Chip"');
    expect(source).toContain('export { Callout } from "./Callout"');
    expect(source).toContain('export { EmptyState } from "./EmptyState"');
  });

  it("renders primitive text content", () => {
    const screen = renderFidy(
      <Row
        title="Theme"
        subtitle="System"
        leading={<Text>Icon</Text>}
        trailing={<Text>Trail</Text>}
      />
    );

    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
    expect(screen.getByText("Icon")).toBeTruthy();
    expect(screen.getByText("Trail")).toBeTruthy();
  });

  it("renders chip, callout, empty state, and button copy", () => {
    const screen = renderFidy(
      <>
        <Chip label="Active" tone="primary" />
        <Callout title="Review needed" subtitle="Check this before saving" />
        <EmptyState title="No notifications" subtitle="You are all caught up" />
        <Button label="Continue" />
      </>
    );

    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Review needed")).toBeTruthy();
    expect(screen.getByText("Check this before saving")).toBeTruthy();
    expect(screen.getByText("No notifications")).toBeTruthy();
    expect(screen.getByText("You are all caught up")).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
  });

  it("keeps SettingsRow as a wrapper around the shared Row primitive", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/settings/components/SettingsRow.tsx"),
      "utf-8"
    );

    expect(source).toContain('import { Row } from "@/shared/components"');
    expect(source).toContain("<Row");
    expect(source).not.toContain("StyleSheet");
  });

  it("keeps migrated empty states and callouts on shared primitives", () => {
    const notificationEmptyStateSource = readFileSync(
      resolve(__dirname, "../../features/notifications/components/NotificationEmptyState.tsx"),
      "utf-8"
    );
    const accountPromptSource = readFileSync(
      resolve(
        __dirname,
        "../../features/account-suggestions/components/AccountSuggestionsPromptBanner.tsx"
      ),
      "utf-8"
    );

    expect(notificationEmptyStateSource).toContain(
      'import { EmptyState } from "@/shared/components"'
    );
    expect(notificationEmptyStateSource).toContain("<EmptyState");
    expect(notificationEmptyStateSource).not.toContain("StyleSheet");
    expect(accountPromptSource).toContain('import { Callout } from "@/shared/components"');
    expect(accountPromptSource).toContain("<Callout");
    expect(accountPromptSource).not.toContain("StyleSheet");
  });

  it("keeps review queue helpers composed from shared primitives", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/review-queues/components/shared.tsx"),
      "utf-8"
    );

    expect(source).toContain("Button");
    expect(source).toContain("Callout");
    expect(source).toContain("SharedEmptyState");
    expect(source).toContain("Row");
    expect(source).not.toContain("StyleSheet");
    expect(source).not.toContain("Pressable");
  });

  it("keeps account suggestion cards composed from shared primitives", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../features/account-suggestions/components/AccountSuggestionCard.tsx"
      ),
      "utf-8"
    );

    expect(source).toContain("Button");
    expect(source).toContain("Card");
    expect(source).toContain("Chip");
    expect(source).not.toContain("StyleSheet");
    expect(source).not.toContain("Pressable");
  });

  it("keeps search filter chips on the shared Chip primitive", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/search/components/FilterChipRow.tsx"),
      "utf-8"
    );

    expect(source).toContain('import { Chip } from "@/shared/components"');
    expect(source).toContain("<Chip");
    expect(source).not.toContain("Pressable");
  });
});
