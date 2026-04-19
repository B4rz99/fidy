import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { fromSync, makeAppService } from "@/shared/effect/runtime";

describe("shared/effect/runtime", () => {
  it("runs tagged effects with a bound service", async () => {
    const Numbers = makeAppService<{ readonly getValue: () => number }>("test/Numbers");
    const runtime = Numbers.bind({
      getValue: () => 42,
    });

    const value = await runtime.run(
      Effect.flatMap(Numbers.tag, ({ getValue }) => Effect.succeed(getValue()))
    );

    expect(value).toBe(42);
  });

  it("preserves the original error when a bound effect fails", async () => {
    const expected = new Error("boom");
    const Failing = makeAppService<{ readonly explode: () => never }>("test/Failing");
    const runtime = Failing.bind({
      explode: () => {
        throw expected;
      },
    });

    await expect(
      runtime.run(Effect.flatMap(Failing.tag, ({ explode }) => fromSync(explode)))
    ).rejects.toBe(expected);
  });
});
