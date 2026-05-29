declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  export type ReactTestInstance = {
    readonly children: readonly unknown[];
    readonly parent: ReactTestInstance | null;
    readonly props: Record<string, any>;
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
  };

  export type ReactTestRenderer = {
    readonly root: ReactTestInstance;
    toJSON(): unknown;
  };

  export function act(callback: () => void): void;

  const TestRenderer: {
    create(ui: ReactElement): ReactTestRenderer;
  };

  export default TestRenderer;
}
