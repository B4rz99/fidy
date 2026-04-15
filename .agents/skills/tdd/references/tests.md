# Good and Bad Tests

## Good Tests

**Integration-style**: Test through real interfaces, not mocks of internal parts.
**Atomic**: Each test verifies exactly one behavior and is fully independent.
**Pure setup**: Use immutable fixtures — no shared mutable state between tests.

```typescript
// GOOD: immutable setup, tests one observable behavior
const emptyCart: Cart = { items: [], total: 0 };

test("checkout confirms a valid cart", async () => {
  const cart = addItem(emptyCart, product);          // returns new Cart
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Characteristics:

- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test
- Input data is immutable — tests cannot interfere with each other

## Bad Tests

**Implementation-detail tests**: Coupled to internal structure.

```typescript
// BAD: tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags:

- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through external means instead of interface

**Mutating shared state**: Breaks atomicity — one test can corrupt another.

```typescript
// BAD: mutates shared object, tests are order-dependent
const cart = new MutableCart();

test("adds item to cart", () => {
  cart.add(product);                   // mutates shared cart
  expect(cart.items).toHaveLength(1);
});

test("calculates total", () => {
  expect(cart.total).toBe(0);          // may fail if previous test ran first
});

// GOOD: immutable, each test is self-contained
test("adds item to cart", () => {
  const cart = addItem(emptyCart, product);
  expect(cart.items).toHaveLength(1);
});

test("calculates total after adding item", () => {
  const cart = addItem(emptyCart, { ...product, price: 10 });
  expect(cart.total).toBe(10);
});
```

**Bypassing the interface to verify**:

```typescript
// BAD: bypasses interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: verifies through the public interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```
