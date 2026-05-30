import { describe, expect, test } from "vitest";
import { Colors } from "@/shared/constants/theme";
import tailwindConfig from "../../tailwind.config";

const twColors = tailwindConfig.theme?.extend?.colors as Record<string, string>;

describe("tailwind <-> Colors sync", () => {
  test("accent-green matches Colors.light.accentGreen", () => {
    expect(twColors["accent-green"]).toBe(Colors.light.accentGreen);
  });

  test("accent-green-dark matches Colors.dark.accentGreen", () => {
    expect(twColors["accent-green-dark"]).toBe(Colors.dark.accentGreen);
  });

  test("page matches Colors.light.page", () => {
    expect(twColors.page).toBe(Colors.light.page);
  });

  test("page-dark matches Colors.dark.page", () => {
    expect(twColors["page-dark"]).toBe(Colors.dark.page);
  });

  test("nav matches Colors.light.nav", () => {
    expect(twColors.nav).toBe(Colors.light.nav);
  });

  test("nav-dark matches Colors.dark.nav", () => {
    expect(twColors["nav-dark"]).toBe(Colors.dark.nav);
  });

  test("chat semantic colors match Colors", () => {
    expect(twColors["chat-assistant-bubble"]).toBe(Colors.light.chatAssistantBubble);
    expect(twColors["chat-assistant-bubble-dark"]).toBe(Colors.dark.chatAssistantBubble);
    expect(twColors["chat-assistant-text"]).toBe(Colors.light.chatAssistantText);
    expect(twColors["chat-assistant-text-dark"]).toBe(Colors.dark.chatAssistantText);
    expect(twColors["chat-user-bubble"]).toBe(Colors.light.chatUserBubble);
    expect(twColors["chat-user-bubble-dark"]).toBe(Colors.dark.chatUserBubble);
    expect(twColors["chat-user-text"]).toBe(Colors.light.chatUserText);
    expect(twColors["chat-user-text-dark"]).toBe(Colors.dark.chatUserText);
  });

  test("semantic UI aliases match Colors", () => {
    expect(twColors.background).toBe(Colors.light.background);
    expect(twColors["background-dark"]).toBe(Colors.dark.background);
    expect(twColors.surface).toBe(Colors.light.surface);
    expect(twColors["surface-dark"]).toBe(Colors.dark.surface);
    expect(twColors["surface-muted"]).toBe(Colors.light.surfaceMuted);
    expect(twColors["surface-muted-dark"]).toBe(Colors.dark.surfaceMuted);
    expect(twColors["text-primary"]).toBe(Colors.light.textPrimary);
    expect(twColors["text-primary-dark"]).toBe(Colors.dark.textPrimary);
    expect(twColors["text-on-accent"]).toBe(Colors.light.textOnAccent);
    expect(twColors["text-on-accent-dark"]).toBe(Colors.dark.textOnAccent);
    expect(twColors["action-primary"]).toBe(Colors.light.actionPrimary);
    expect(twColors["action-primary-dark"]).toBe(Colors.dark.actionPrimary);
    expect(twColors.danger).toBe(Colors.light.danger);
    expect(twColors["danger-dark"]).toBe(Colors.dark.danger);
  });

  test("chart-food matches Colors.chart.food", () => {
    expect(twColors["chart-food"]).toBe(Colors.chart.food);
  });

  test("chart-transport matches Colors.chart.transport", () => {
    expect(twColors["chart-transport"]).toBe(Colors.chart.transport);
  });

  test("chart-entertainment matches Colors.chart.entertainment", () => {
    expect(twColors["chart-entertainment"]).toBe(Colors.chart.entertainment);
  });

  test("chart-health matches Colors.chart.health", () => {
    expect(twColors["chart-health"]).toBe(Colors.chart.health);
  });

  test("chart-education matches Colors.chart.education", () => {
    expect(twColors["chart-education"]).toBe(Colors.chart.education);
  });

  test("chart-home matches Colors.chart.home", () => {
    expect(twColors["chart-home"]).toBe(Colors.chart.home);
  });

  test("chart-clothing matches Colors.chart.clothing", () => {
    expect(twColors["chart-clothing"]).toBe(Colors.chart.clothing);
  });

  test("chart-services matches Colors.chart.services", () => {
    expect(twColors["chart-services"]).toBe(Colors.chart.services);
  });

  test("chart-transfer matches Colors.chart.transfer", () => {
    expect(twColors["chart-transfer"]).toBe(Colors.chart.transfer);
  });

  test("chart-other matches Colors.chart.other", () => {
    expect(twColors["chart-other"]).toBe(Colors.chart.other);
  });
});
