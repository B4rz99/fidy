# Interface Design for Testability

Good interfaces make testing natural:

1. **Accept dependencies, don't create them**

   ```typescript
   // Testable: dependency is injected as a function
   function processOrder(order: Order, charge: (amount: number) => Promise<Receipt>) {}

   // Hard to test: creates its own dependency
   function processOrder(order: Order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Return results, don't mutate inputs**

   Pure functions are the easiest to test: same input always produces same
   output, no setup or teardown needed.

   ```typescript
   // Testable: pure, returns new value
   function applyDiscount(cart: Cart, rate: number): Cart {
     return { ...cart, total: cart.total * (1 - rate) };
   }

   // Hard to test: mutates shared state
   function applyDiscount(cart: Cart): void {
     cart.total -= discount;
   }
   ```

3. **Separate pure logic from effects**

   Keep the core logic pure; push effects (I/O, network, time) to the edges.
   This is the "functional core, imperative shell" pattern.

   ```typescript
   // Pure core — trivially testable, no mocks needed
   function buildOrderSummary(cart: Cart, user: User): OrderSummary {
     return { items: cart.items, total: cart.total, userId: user.id };
   }

   // Effectful shell — thin, easy to inspect manually or integration-test
   async function submitOrder(cart: Cart, user: User): Promise<void> {
     const summary = buildOrderSummary(cart, user);
     await db.orders.insert(summary);
     await email.send(user.email, summary);
   }
   ```

4. **Use immutable data**

   Immutable values eliminate shared-state bugs and make tests independent.

   ```typescript
   // Immutable: safe to share across tests
   const baseCart: Cart = { items: [], total: 0 };

   // Mutable: leaks state between tests
   const baseCart = new MutableCart();
   ```

5. **Small surface area**
   - Fewer functions = fewer tests needed
   - Fewer params = simpler test setup
   - Prefer data-in / data-out over stateful objects
