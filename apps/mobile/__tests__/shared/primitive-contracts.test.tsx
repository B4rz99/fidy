import { describe, expect, it } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { Card } from "@/shared/components/Card";
import { FieldButton } from "@/shared/components/FieldButton";
import { FormTextField } from "@/shared/components/FormTextField";
import { GlassPressable } from "@/shared/components/GlassPressable";
import { GlassSurface } from "@/shared/components/GlassSurface";
import { IconActionButton } from "@/shared/components/IconActionButton";
import { ListRowSurface } from "@/shared/components/ListRowSurface";
import { TextActionButton } from "@/shared/components/TextActionButton";
import { StyleSheet, Text } from "@/shared/components/rn";

type ContractNode = {
  readonly children: readonly unknown[];
  readonly parent: ContractNode | null;
  readonly props: Record<string, unknown>;
  readonly type: unknown;
  findAll(predicate: (node: ContractNode) => boolean): ContractNode[];
};

function asContractNode(node: unknown) {
  return node as ContractNode;
}

function flattenStyle(style: unknown): Record<string, unknown> | null {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle).filter(Boolean)) as Record<string, unknown>;
  }

  return StyleSheet.flatten(style) as Record<string, unknown> | null;
}

function findByType(root: ContractNode, type: string) {
  return root.findAll((node) => node.type === type);
}

function findNodeByText(root: ContractNode, text: string) {
  return root.findAll((node) => node.children.includes(text))[0] ?? null;
}

function nearestAncestor(
  node: ContractNode | null,
  predicate: (candidate: ContractNode) => boolean
) {
  let current = node?.parent ?? null;
  while (current != null) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return null;
}

function findStyledView(
  root: ContractNode,
  predicate: (style: Record<string, unknown>) => boolean
) {
  return findByType(root, "View").find((node) => {
    const style = flattenStyle(node.props.style);
    return style != null && predicate(style);
  });
}

describe("shared primitive contracts", () => {
  it("routes Card visual props to the glass surface and keeps content layout separate", () => {
    const screen = renderFidy(
      <Card
        backgroundColor="#111111"
        borderColor="#22aa66"
        borderWidth={2}
        contentStyle={{ gap: 6 }}
        radius={20}
        layoutStyle={{ marginTop: 4 }}
      >
        <Text>Card content</Text>
      </Card>
    );

    const root = asContractNode(screen.root);
    const surface = findStyledView(root, (style) => style.borderColor === "#22aa66");
    const content = nearestAncestor(
      findNodeByText(root, "Card content"),
      (node) => flattenStyle(node.props.style)?.gap === 6
    );
    const surfaceStyle = flattenStyle(surface?.props.style);

    expect(surfaceStyle).toMatchObject({
      backgroundColor: "#111111",
      borderColor: "#22aa66",
      borderRadius: 20,
      borderWidth: 2,
      marginTop: 4,
    });
    expect(content).toBeTruthy();
  });

  it("keeps layout props from overriding GlassSurface visual tokens", () => {
    const screen = renderFidy(
      <GlassSurface
        backgroundColor="#111111"
        borderColor="#22aa66"
        borderStyle="dashed"
        borderWidth={2}
        radius={20}
        style={{
          backgroundColor: "#ff0000",
          borderColor: "#0000ff",
          borderRadius: 4,
          borderStyle: "solid",
          marginTop: 8,
        }}
      >
        <Text>Glass content</Text>
      </GlassSurface>
    );
    const root = asContractNode(screen.root);
    const surface = findStyledView(root, (style) => style.marginTop === 8);

    expect(flattenStyle(surface?.props.style)).toMatchObject({
      backgroundColor: "#111111",
      borderColor: "#22aa66",
      borderRadius: 20,
      borderStyle: "dashed",
      borderWidth: 2,
      marginTop: 8,
    });
  });

  it("keeps GlassPressable as the sole interactive shell around a presentational surface", () => {
    const screen = renderFidy(
      <GlassPressable
        accessibilityLabel="Glass action"
        backgroundColor="#123456"
        borderColor="#abcdef"
        radius={12}
      >
        <Text>Run</Text>
      </GlassPressable>
    );
    const button = asContractNode(screen.getByA11yLabel("Glass action"));
    const root = asContractNode(screen.root);
    const surface = findStyledView(root, (style) => style.borderColor === "#abcdef");

    expect(button.type).toBe("Pressable");
    expect(button.props.accessibilityRole).toBe("button");
    expect(surface?.props.pointerEvents).toBe("none");
    expect(flattenStyle(surface?.props.style)).toMatchObject({
      backgroundColor: "#123456",
      borderColor: "#abcdef",
      borderRadius: 12,
    });
  });

  it("keeps standalone ListRowSurface selected borders and disabled opacity consistent", () => {
    const screen = renderFidy(
      <ListRowSurface
        accessibilityLabel="Open row"
        disabled
        minHeight={72}
        onPress={() => undefined}
        selected
        selectedBorderColor="#55cc88"
      >
        <Text>Row content</Text>
      </ListRowSurface>
    );
    const pressable = screen.getByA11yLabel("Open row");
    const surface = findStyledView(
      asContractNode(screen.root),
      (style) => style.borderColor === "#55cc88"
    );
    const rowContentStyle = flattenStyle(surface?.props.style);

    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toMatchObject({ disabled: true, selected: true });
    expect(flattenStyle(pressable.props.style)).toMatchObject({ opacity: 1 });
    expect(rowContentStyle).toMatchObject({ borderColor: "#55cc88" });
  });

  it("uses explicit ListRowSurface layout and divider props", () => {
    const screen = renderFidy(
      <ListRowSurface
        accessibilityLabel="Grouped row"
        divider
        dividerColor="#ddeeff"
        layoutStyle={{ marginTop: 6 }}
        variant="grouped"
      >
        <Text>Grouped row</Text>
      </ListRowSurface>
    );
    const groupedRow = asContractNode(screen.getByA11yLabel("Grouped row"));

    expect(flattenStyle(groupedRow.props.style)).toMatchObject({
      borderBottomColor: "#ddeeff",
      marginTop: 6,
    });
  });

  it("keeps grouped ListRowSurface non-glass and divider-only", () => {
    const screen = renderFidy(
      <ListRowSurface variant="grouped" divider accessibilityLabel="Grouped row">
        <Text>Grouped content</Text>
      </ListRowSurface>
    );
    const groupedRow = asContractNode(screen.getByA11yLabel("Grouped row"));

    expect(groupedRow.type).toBe("View");
    expect(flattenStyle(groupedRow.props.style)).toMatchObject({
      borderBottomWidth: StyleSheet.hairlineWidth,
      minHeight: 56,
    });
  });

  it("keeps IconActionButton plain by default and glass-backed only for surface tone", () => {
    const plain = renderFidy(
      <IconActionButton accessibilityLabel="Plain action" icon={<Text>Icon</Text>} />
    );
    const surface = renderFidy(
      <IconActionButton
        accessibilityLabel="Surface action"
        backgroundColor="#778899"
        icon={<Text>Icon</Text>}
        tone="surface"
      />
    );

    const plainButton = asContractNode(plain.getByA11yLabel("Plain action"));

    expect(plainButton.type).toBe("Pressable");
    expect(plainButton.props.className).toContain("rounded-full");
    expect(
      findStyledView(asContractNode(surface.root), (style) => style.backgroundColor === "#778899")
    ).toBeTruthy();
  });

  it("keeps FieldButton sizing split between shell and field content", () => {
    const screen = renderFidy(
      <FieldButton
        accessibilityLabel="Pick date"
        buttonStyle={{ flex: 1, minHeight: 52, paddingHorizontal: 18, width: 180 }}
        label="Date"
        onPress={() => undefined}
        value="Today"
      />
    );
    const root = asContractNode(screen.root);
    const fieldShell = findStyledView(root, (style) => style.width === 180);
    const fieldContent = findStyledView(root, (style) => style.paddingHorizontal === 18);

    expect(asContractNode(screen.getByA11yLabel("Pick date")).type).toBe("Pressable");
    expect(flattenStyle(fieldShell?.props.style)).toMatchObject({ flex: 1, width: 180 });
    expect(flattenStyle(fieldShell?.props.style)?.paddingHorizontal).toBeUndefined();
    expect(flattenStyle(fieldContent?.props.style)).toMatchObject({
      minHeight: 52,
      paddingHorizontal: 18,
    });
  });

  it("keeps FormTextField TextInput styling transparent while field sizing stays on the surface", () => {
    const screen = renderFidy(
      <FormTextField
        inputStyle={{ height: 52, minWidth: 96, width: 160 }}
        label="Account"
        onChangeText={() => undefined}
        value="Cash"
      />
    );
    const root = asContractNode(screen.root);
    const input = findByType(root, "TextInput")[0];
    const shell = findStyledView(root, (style) => style.width === 160);
    const inputStyle = flattenStyle(input?.props.style);

    expect(shell).toBeTruthy();
    expect(flattenStyle(shell?.props.style)).toMatchObject({ minWidth: 96, width: 160 });
    expect(inputStyle).toMatchObject({
      backgroundColor: "transparent",
      borderWidth: 0,
      minHeight: 52,
    });
  });

  it("keeps TextActionButton pill and plain appearances explicit", () => {
    const pill = renderFidy(<TextActionButton label="See all" />);
    const plain = renderFidy(<TextActionButton appearance="plain" label="Delete account" />);

    expect(pill.getByText("See all").parent?.props.className).toContain("rounded-full");
    expect(pill.getByText("See all").parent?.props.className).toContain("min-h-8");
    expect(plain.getByText("Delete account").parent?.props.className).not.toContain("rounded-full");
    expect(plain.getByText("Delete account").parent?.props.className).not.toContain("min-h-8");
  });
});
