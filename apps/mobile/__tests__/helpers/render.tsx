import { createRequire } from "node:module";
import type { ReactElement } from "react";
import * as reactNativeMock from "./react-native-mock";

type TestNode = {
  readonly children: readonly unknown[];
  readonly parent: TestNode | null;
  readonly props: Record<string, unknown>;
  findAll(predicate: (node: TestNode) => boolean): TestNode[];
};

type TestingLibrary = {
  readonly fireEvent: {
    press(element: TestNode, ...data: unknown[]): void;
  };
  render(ui: ReactElement): {
    readonly root: TestNode;
    getAllByText(text: string | RegExp): TestNode[];
    getByLabelText(text: string | RegExp): TestNode;
    getByText(text: string | RegExp): TestNode;
    queryAllByLabelText(text: string | RegExp): TestNode[];
    queryAllByText(text: string | RegExp): TestNode[];
    queryByLabelText(text: string | RegExp): TestNode | null;
    queryByText(text: string | RegExp): TestNode | null;
    toJSON(): unknown;
  };
};

const require = createRequire(import.meta.url);
let testingLibrary: TestingLibrary | undefined;

const pressEvent = {
  nativeEvent: {},
  target: null,
};

function stableText(text: string | RegExp) {
  return typeof text === "string" ? text : new RegExp(text.source, text.flags.replace(/[gy]/g, ""));
}

function getTestingLibrary() {
  if (testingLibrary != null) {
    return testingLibrary;
  }

  const reactNativePath = require.resolve("react-native");
  require.cache[reactNativePath] = {
    exports: reactNativeMock,
  } as NodeJS.Module;
  testingLibrary = require("@testing-library/react-native/pure") as TestingLibrary;

  return testingLibrary;
}

export function renderFidy(ui: ReactElement) {
  const { fireEvent, render } = getTestingLibrary();
  const activeRenderer = render(ui);
  const root = activeRenderer.root;
  const queryByText = (text: string | RegExp) =>
    activeRenderer.queryAllByText(stableText(text))[0] ?? null;
  const queryByA11yLabel = (label: string | RegExp) =>
    activeRenderer.queryAllByLabelText(stableText(label))[0] ?? null;

  return {
    ...activeRenderer,
    root,
    toJSON: () => activeRenderer.toJSON(),
    press: (node: TestNode) => fireEvent.press(node, pressEvent),
    getAllByText: (text: string | RegExp) => activeRenderer.getAllByText(stableText(text)),
    getByText: (text: string | RegExp) => {
      const match = queryByText(text);

      if (!match) {
        throw new Error(`Unable to find text: ${String(text)}`);
      }

      return match;
    },
    getByA11yLabel: (label: string | RegExp) => {
      return activeRenderer.getByLabelText(stableText(label));
    },
    pressByText: (text: string | RegExp) => {
      fireEvent.press(activeRenderer.getByText(stableText(text)), pressEvent);
    },
    pressByA11yLabel: (label: string | RegExp) => {
      fireEvent.press(activeRenderer.getByLabelText(stableText(label)), pressEvent);
    },
    queryByText,
    queryByA11yLabel,
  };
}
