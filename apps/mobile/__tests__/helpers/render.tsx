import type { ReactElement } from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

const pressEvent = {
  nativeEvent: {},
  target: null,
};

export function renderFidy(ui: ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  act(() => {
    renderer = TestRenderer.create(ui);
  });

  if (renderer == null) {
    throw new Error("React Native tree was not rendered");
  }

  const activeRenderer = renderer;
  const root = activeRenderer.root;
  const textNodes = () =>
    root.findAll(
      (node: ReactTestInstance) =>
        Array.isArray(node.children) &&
        node.children.length > 0 &&
        typeof node.children[0] === "string"
    );
  const queryByText = (text: string | RegExp) =>
    textNodes().find((node: ReactTestInstance) => {
      const value = node.children.join("");
      return typeof text === "string" ? value === text : text.test(value);
    }) ?? null;
  const queryByA11yLabel = (label: string | RegExp) =>
    root.findAll((node: ReactTestInstance) => {
      const value = node.props.accessibilityLabel;
      return (
        typeof value === "string" &&
        (typeof label === "string" ? value === label : label.test(value))
      );
    })[0] ?? null;
  const pressableAncestor = (node: ReactTestInstance): ReactTestInstance | null => {
    if (typeof node.props.onPress === "function") {
      return node;
    }

    return node.parent ? pressableAncestor(node.parent) : null;
  };

  return {
    root,
    toJSON: () => activeRenderer.toJSON(),
    press: (node: TestRenderer.ReactTestInstance) => {
      act(() => {
        node.props.onPress(pressEvent);
      });
    },
    getAllByText: (text: string | RegExp) =>
      textNodes().filter((node: ReactTestInstance) => {
        const value = node.children.join("");
        return typeof text === "string" ? value === text : text.test(value);
      }),
    getByText: (text: string | RegExp) => {
      const match = queryByText(text);

      if (!match) {
        throw new Error(`Unable to find text: ${String(text)}`);
      }

      return match;
    },
    getByA11yLabel: (label: string | RegExp) => {
      const match = queryByA11yLabel(label);

      if (!match) {
        throw new Error(`Unable to find accessibility label: ${String(label)}`);
      }

      return match;
    },
    pressByText: (text: string | RegExp) => {
      const match = queryByText(text);
      const pressable = match ? pressableAncestor(match) : null;

      if (!pressable) {
        throw new Error(`Unable to find pressable text: ${String(text)}`);
      }

      act(() => {
        pressable.props.onPress(pressEvent);
      });
    },
    pressByA11yLabel: (label: string | RegExp) => {
      const match = queryByA11yLabel(label);

      if (!match || typeof match.props.onPress !== "function") {
        throw new Error(`Unable to find pressable accessibility label: ${String(label)}`);
      }

      act(() => {
        match.props.onPress(pressEvent);
      });
    },
    queryByText,
  };
}
