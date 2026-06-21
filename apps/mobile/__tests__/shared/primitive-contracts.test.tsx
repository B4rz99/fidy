import { describe, expect, it } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { AddActionButton } from "@/shared/components/AddActionButton";
import { Card } from "@/shared/components/Card";
import { FieldButton } from "@/shared/components/FieldButton";
import { FormTextField } from "@/shared/components/FormTextField";
import { SurfacePressable } from "@/shared/components/SurfacePressable";
import { SolidSurface } from "@/shared/components/SolidSurface";
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

function findStyledNode(
  root: ContractNode,
  predicate: (style: Record<string, unknown>) => boolean
) {
  return root.findAll((node) => {
    const style = flattenStyle(node.props.style);
    return style != null && predicate(style);
  })[0];
}

describe("shared primitive contracts", () => {
  it("keeps Card layout and content separate with shared solid fills", () => {
    const screen = renderFidy(
      <Card contentStyle={{ gap: 6 }} radius={20} layoutStyle={{ marginTop: 4 }}>
        <Text>Card content</Text>
      </Card>
    );

    const root = asContractNode(screen.root);
    const surface = findStyledView(root, (style) => style.marginTop === 4);
    const content = nearestAncestor(
      findNodeByText(root, "Card content"),
      (node) => flattenStyle(node.props.style)?.gap === 6
    );
    const surfaceStyle = flattenStyle(surface?.props.style);

    expect(surfaceStyle).toMatchObject({
      borderRadius: 20,
      marginTop: 4,
    });
    expect(surfaceStyle).toHaveProperty("backgroundColor", "#FFFFFF");
    expect(surfaceStyle).toHaveProperty("borderColor", "#00000030");
    expect(surfaceStyle).toHaveProperty("borderWidth");
    expect(content).toBeTruthy();
  });

  it("keeps layout props from overriding SolidSurface fill tokens", () => {
    const screen = renderFidy(
      <SolidSurface
        backgroundColor="#111111"
        radius={20}
        style={{
          backgroundColor: "#ff0000",
          borderColor: "#0000ff",
          borderRadius: 4,
          borderStyle: "solid",
          marginTop: 8,
        }}
      >
        <Text>Surface content</Text>
      </SolidSurface>
    );
    const root = asContractNode(screen.root);
    const surface = findStyledView(root, (style) => style.marginTop === 8);

    expect(flattenStyle(surface?.props.style)).toMatchObject({
      backgroundColor: "#111111",
      borderColor: "#00000030",
      borderRadius: 20,
      marginTop: 8,
    });
    expect(flattenStyle(surface?.props.style)).not.toHaveProperty("borderStyle");
    expect(flattenStyle(surface?.props.style)).toHaveProperty("borderWidth");
  });

  it("keeps SurfacePressable as the sole interactive shell around a presentational surface", () => {
    const screen = renderFidy(
      <SurfacePressable accessibilityLabel="Surface action" backgroundColor="#123456" radius={12}>
        <Text>Run</Text>
      </SurfacePressable>
    );
    const button = asContractNode(screen.getByA11yLabel("Surface action"));
    const root = asContractNode(screen.root);
    const surface = findStyledView(root, (style) => style.backgroundColor === "#123456");

    expect(button.type).toBe("Pressable");
    expect(button.props.accessibilityRole).toBe("button");
    expect(surface?.props.pointerEvents).toBe("none");
    expect(flattenStyle(surface?.props.style)).toMatchObject({
      backgroundColor: "#123456",
      borderColor: "#00000030",
      borderRadius: 12,
    });
  });

  it("uses native platform feedback for shared add actions", () => {
    const screen = renderFidy(<AddActionButton accessibilityLabel="Create item" />);
    const button = asContractNode(screen.getByA11yLabel("Create item"));
    const surface = findStyledView(
      asContractNode(screen.root),
      (style) => style.height === 44 && style.width === 44
    );

    expect(button.props.android_ripple).toMatchObject({ borderless: false });
    expect(surface?.props.pointerEvents).toBe("auto");
  });

  it("keeps standalone ListRowSurface selected state accessible without decorative borders", () => {
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
    const content = nearestAncestor(
      findNodeByText(asContractNode(screen.root), "Row content"),
      (node) => flattenStyle(node.props.style)?.minHeight === 72
    );

    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toMatchObject({ disabled: true, selected: true });
    expect(flattenStyle(pressable.props.style)).toMatchObject({ opacity: 1 });
    expect(
      findStyledView(asContractNode(screen.root), (style) => style.borderColor === "#55cc88")
    ).toBeUndefined();
    expect(content).toBeTruthy();
  });

  it("ignores grouped ListRowSurface divider props while keeping layout", () => {
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
      marginTop: 6,
    });
    expect(flattenStyle(groupedRow.props.style)).not.toHaveProperty("borderBottomColor");
    expect(flattenStyle(groupedRow.props.style)).not.toHaveProperty("borderBottomWidth");
  });

  it("routes standalone ListRowSurface layout keys to shell and row content", () => {
    const screen = renderFidy(
      <ListRowSurface
        accessibilityLabel="Standalone row"
        layoutStyle={{ marginTop: 6, minHeight: 80, paddingHorizontal: 20 }}
      >
        <Text>Standalone content</Text>
      </ListRowSurface>
    );
    const root = asContractNode(screen.root);
    const surface = findStyledView(root, (style) => style.marginTop === 6);
    const rowContent = nearestAncestor(
      findNodeByText(root, "Standalone content"),
      (node) =>
        flattenStyle(node.props.style)?.minHeight === 80 &&
        flattenStyle(node.props.style)?.paddingHorizontal === 20
    );

    expect(flattenStyle(surface?.props.style)).toMatchObject({ marginTop: 6, minHeight: 80 });
    expect(flattenStyle(surface?.props.style)?.paddingHorizontal).toBeUndefined();
    expect(rowContent).toBeTruthy();
  });

  it("keeps grouped ListRowSurface non-surface without dividers", () => {
    const screen = renderFidy(
      <ListRowSurface variant="grouped" divider accessibilityLabel="Grouped row">
        <Text>Grouped content</Text>
      </ListRowSurface>
    );
    const groupedRow = asContractNode(screen.getByA11yLabel("Grouped row"));

    expect(groupedRow.type).toBe("View");
    expect(flattenStyle(groupedRow.props.style)).toMatchObject({
      minHeight: 56,
    });
    expect(flattenStyle(groupedRow.props.style)).not.toHaveProperty("borderBottomWidth");
  });

  it("keeps IconActionButton solid-backed for surface tone", () => {
    const plain = renderFidy(
      <IconActionButton accessibilityLabel="Plain action" icon={<Text>Icon</Text>} />
    );
    const surface = renderFidy(
      <IconActionButton
        accessibilityLabel="Surface action"
        icon={<Text>Icon</Text>}
        tone="surface"
      />
    );

    const plainButton = asContractNode(plain.getByA11yLabel("Plain action"));

    expect(plainButton.type).toBe("Pressable");
    expect(
      findStyledView(asContractNode(plain.root), (style) => style.borderRadius === 999)
    ).toBeTruthy();
    expect(
      findStyledView(asContractNode(surface.root), (style) => style.backgroundColor === "#FFFFFF")
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
        inputStyle={{
          height: 52,
          minWidth: 96,
          paddingHorizontal: 10,
          paddingVertical: 6,
          width: 160,
        }}
        label="Account"
        onChangeText={() => undefined}
        value="Cash"
      />
    );
    const root = asContractNode(screen.root);
    const input = findByType(root, "TextInput")[0];
    const shell = findStyledView(root, (style) => style.width === 160);
    const content = findStyledView(root, (style) => style.paddingHorizontal === 10);
    const inputStyle = flattenStyle(input?.props.style);

    expect(shell).toBeTruthy();
    expect(flattenStyle(shell?.props.style)).toMatchObject({ minWidth: 96, width: 160 });
    expect(flattenStyle(content?.props.style)).toMatchObject({
      paddingHorizontal: 10,
      paddingVertical: 6,
    });
    expect(inputStyle).toMatchObject({
      backgroundColor: "transparent",
      borderWidth: 0,
      minHeight: 52,
    });
    expect(inputStyle?.paddingHorizontal).toBe(0);
    expect(inputStyle?.paddingVertical).toBeUndefined();
  });

  it("keeps TextActionButton pill and plain appearances explicit", () => {
    const pill = renderFidy(<TextActionButton label="See all" />);
    const plain = renderFidy(<TextActionButton appearance="plain" label="Delete account" />);

    expect(
      findStyledNode(asContractNode(pill.root), (style) => style.borderRadius === 999)
    ).toBeTruthy();
    expect(
      findStyledNode(asContractNode(pill.root), (style) => style.minHeight === 32)
    ).toBeTruthy();
    expect(
      findStyledNode(asContractNode(plain.root), (style) => style.borderRadius === 10)
    ).toBeTruthy();
    expect(
      findStyledNode(
        asContractNode(plain.root),
        (style) => style.minHeight === 44 && style.minWidth === 72
      )
    ).toBeTruthy();
  });
});
