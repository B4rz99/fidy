import { createRequire } from "node:module";
import { act } from "react";
import type { ReactElement } from "react";
import * as reactNativeMock from "./react-native-mock";

type TestNode = {
  readonly children: readonly unknown[];
  readonly parent: TestNode | null;
  readonly props: Record<string, unknown>;
  findAll(predicate: (node: TestNode) => boolean): TestNode[];
  queryAll?(
    predicate: (node: TestNode) => boolean,
    options?: { readonly includeSelf?: boolean }
  ): TestNode[];
};

type TestingLibrary = {
  readonly createRoot: (options: {
    readonly publicTextComponentTypes: readonly string[];
    readonly textComponentTypes: readonly string[];
    readonly transformHiddenInstanceProps: (input: {
      readonly props: Record<string, unknown>;
    }) => Record<string, unknown>;
  }) => {
    readonly container: TestNode & { toJSON(): JsonElement | null };
    render(ui: ReactElement): void;
    unmount(): void;
  };
  readonly getQueriesForInstance: (root: TestNode) => RenderQueries;
};

type JsonElement = {
  readonly children: readonly (JsonElement | string)[];
};

type RenderQueries = {
  getAllByText(text: string | RegExp): TestNode[];
  getByLabelText(text: string | RegExp): TestNode;
  getByText(text: string | RegExp): TestNode;
  queryAllByLabelText(text: string | RegExp): TestNode[];
  queryAllByText(text: string | RegExp): TestNode[];
  queryByLabelText(text: string | RegExp): TestNode | null;
  queryByText(text: string | RegExp): TestNode | null;
};

const require = createRequire(import.meta.url);
let testingLibrary: TestingLibrary | undefined;

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
  testingLibrary = {
    createRoot: require("test-renderer").createRoot,
    getQueriesForInstance: require("@testing-library/react-native/dist/within")
      .getQueriesForInstance,
  } as TestingLibrary;

  return testingLibrary;
}

function installFindAll(container: TestNode) {
  const prototype = Object.getPrototypeOf(container) as
    | { findAll?: (predicate: (node: TestNode) => boolean) => TestNode[] }
    | undefined;

  if (prototype?.findAll != null) {
    return;
  }

  Object.defineProperty(prototype, "findAll", {
    value(this: TestNode, predicate: (node: TestNode) => boolean) {
      return this.queryAll?.(predicate, { includeSelf: true }) ?? [];
    },
  });
}

function toJSON(container: TestNode & { toJSON(): JsonElement | null }) {
  const json = container.toJSON();

  if (json?.children.length === 0) {
    return null;
  }

  if (json?.children.length === 1 && typeof json.children[0] !== "string") {
    return json.children[0];
  }

  return json;
}

function findPressHandler(node: TestNode): (() => void) | null {
  if (typeof node.props.onPress === "function") {
    return node.props.onPress as () => void;
  }

  return node.parent == null ? null : findPressHandler(node.parent);
}

function press(element: TestNode) {
  const handler = findPressHandler(element);

  if (handler == null) {
    return;
  }

  act(() => {
    (handler as (event: typeof pressEvent) => void)(pressEvent);
  });
}

const pressEvent = {
  nativeEvent: {},
  stopPropagation: () => undefined,
  target: null,
};

export function renderFidy(ui: ReactElement) {
  const { createRoot, getQueriesForInstance } = getTestingLibrary();
  const renderer = createRoot({
    textComponentTypes: ["Text"],
    publicTextComponentTypes: ["Text"],
    transformHiddenInstanceProps: ({ props }) => ({
      ...props,
      style: [{ display: "none" }, props.style],
    }),
  });

  act(() => {
    renderer.render(ui);
  });

  installFindAll(renderer.container);

  const activeRenderer = getQueriesForInstance(renderer.container);
  const root =
    renderer.container.children.find((child): child is TestNode => typeof child !== "string") ??
    renderer.container;

  const queryByText = (text: string | RegExp) =>
    activeRenderer.queryAllByText(stableText(text))[0] ?? null;
  const queryByA11yLabel = (label: string | RegExp) =>
    activeRenderer.queryAllByLabelText(stableText(label))[0] ?? null;

  return {
    ...activeRenderer,
    root,
    rerender: (component: ReactElement) => {
      act(() => {
        renderer.render(component);
      });
    },
    toJSON: () => toJSON(renderer.container),
    press,
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
      press(activeRenderer.getByText(stableText(text)));
    },
    pressByA11yLabel: (label: string | RegExp) => {
      press(activeRenderer.getByLabelText(stableText(label)));
    },
    queryByText,
    queryByA11yLabel,
  };
}
