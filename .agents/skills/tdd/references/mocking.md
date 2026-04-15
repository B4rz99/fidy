# When to Mock

Mock at **system boundaries** only:

- External APIs (payment, email, etc.)
- Databases (sometimes - prefer test DB)
- Time/randomness
- File system (sometimes)

Don't mock:

- Your own pure functions — just call them
- Internal collaborators
- Anything you control

The best code needs no mocks at all: pure functions take inputs and return
outputs. Reserve mocks for the unavoidable effectful boundary.

## Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Inject dependencies as functions, not objects**

Pass a plain function instead of a class instance — it's simpler to mock and
keeps the call site pure-looking:

```typescript
// Easy to mock: pass any function with the right signature
function processPayment(
  order: Order,
  charge: (amount: number) => Promise<Receipt>,
): Promise<Receipt> {
  return charge(order.total);
}

// Test: no class, no spy setup
const result = await processPayment(order, async (amount) => ({ id: "r1", amount }));

// Hard to mock: requires instantiating or spying on a class
function processPayment(order: Order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of one generic
function with conditional logic:

```typescript
// GOOD: each function is independently mockable, typed per shape
const api = {
  getUser:     (id: string)   => fetch(`/users/${id}`).then(r => r.json()),
  getOrders:   (userId: string) => fetch(`/users/${userId}/orders`).then(r => r.json()),
  createOrder: (data: NewOrder) => fetch('/orders', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
};

// BAD: mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint: string, options?: RequestInit) => fetch(endpoint, options),
};
```

**3. Separate pure logic from the effectful call**

Extract the pure computation so most tests never touch the mock at all:

```typescript
// Pure — test this without any mock
function buildChargeRequest(order: Order): ChargeRequest {
  return { amount: order.total, currency: order.currency, idempotencyKey: order.id };
}

// Effectful shell — only integration tests need the mock
async function chargeOrder(
  order: Order,
  charge: (req: ChargeRequest) => Promise<Receipt>,
): Promise<Receipt> {
  return charge(buildChargeRequest(order));
}
```
