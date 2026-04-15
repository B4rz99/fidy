# Reference

## Dependency Categories

When assessing a candidate for deepening, classify its dependencies.
Prefer categories closer to the top — they require fewer mocks and produce
purer, more atomic tests.

### 1. In-process

Pure computation only: data in, data out, no I/O, no shared mutable state.
Always deepenable — merge the modules and test the pure boundary directly.

No mocks needed. Tests are fully atomic: given the same immutable inputs,
the function always returns the same output.

```typescript
// Pure core — zero setup, zero teardown, fully isolated
test("calculates discounted total", () => {
  const cart = { items: [{ price: 100 }], total: 100 };
  expect(applyDiscount(cart, 0.1)).toEqual({ ...cart, total: 90 });
});
```

### 2. Local-substitutable

Dependencies that have lightweight local stand-ins (e.g., PGLite for Postgres,
in-memory filesystem, fake clock). Deepenable when the stand-in exists.

Tests run the stand-in in-process. Keep test fixtures immutable — construct
fresh state per test, never mutate shared stand-in state between tests.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (microservices, internal APIs).
Apply the **functional core, imperative shell** pattern:

- Define a port (interface) at the module boundary
- The deep module owns the pure logic; the transport is injected
- Production uses the real HTTP/gRPC adapter
- Tests use a pure in-memory adapter — no network, no shared state

```typescript
// Port (pure interface)
type OrderPort = {
  getOrder: (id: string) => Promise<Order>;
  saveOrder: (order: Order) => Promise<void>;
};

// Pure core — testable with in-memory adapter
async function processOrder(id: string, port: OrderPort): Promise<OrderResult> {
  const order = await port.getOrder(id);
  return applyBusinessRules(order); // pure transformation
}
```

### 4. True external (Mock)

Third-party services you don't control (Stripe, Twilio, etc.). Mock at the
boundary only. The deepened module takes the external dependency as an injected
function or port; tests provide a pure mock implementation.

Extract as much logic as possible into the pure core so the mock is only
invoked for the unavoidable side effect, not for any business logic.

## Testing Strategy

The core principle: **replace, don't layer.**

- Old unit tests on shallow modules are waste once boundary tests exist — delete them
- Write new tests at the deepened module's interface boundary
- Use immutable fixtures — construct fresh data per test, never share mutable state
- Tests assert on observable outcomes through the public interface, not internal state
- Tests must survive internal refactors — they describe behavior, not implementation
- Each test is atomic: it verifies exactly one behavior with no dependencies on
  other tests

## Issue Template

<issue-template>

## Problem

Describe the architectural friction:

- Which modules are shallow and tightly coupled
- What integration risk exists in the seams between them
- Why this makes the codebase harder to navigate and maintain

## Proposed Interface

The chosen interface design:

- Interface signature (types, methods, params — prefer immutable data in/out)
- Usage example showing how callers use it
- What complexity it hides internally

## Dependency Strategy

Which category applies and how dependencies are handled:

- **In-process**: merged directly, pure functions, no mocks needed
- **Local-substitutable**: tested with [specific stand-in], immutable fixtures
- **Ports & adapters**: port definition, production adapter, in-memory test adapter
- **Mock**: mock boundary for external services; logic extracted to pure core

## Testing Strategy

- **New boundary tests to write**: describe the behaviors to verify at the interface
- **Old tests to delete**: list the shallow module tests that become redundant
- **Test environment needs**: any local stand-ins or adapters required
- **Atomicity**: confirm each test is independent and uses immutable fixtures

## Implementation Recommendations

Durable architectural guidance that is NOT coupled to current file paths:

- What the module should own (responsibilities)
- What it should hide (implementation details)
- What it should expose (the interface contract — prefer data in/data out)
- Where the pure core ends and the effectful shell begins
- How callers should migrate to the new interface

</issue-template>
