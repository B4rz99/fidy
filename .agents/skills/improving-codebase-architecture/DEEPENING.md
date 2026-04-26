# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. This complements [REFERENCE.md](REFERENCE.md), which keeps the local functional-core and atomic-testing guidance.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable: merge the modules and test through the new interface directly. No adapter needed.

### 2. Local-substitutable

Dependencies that have local test stand-ins, such as PGLite for Postgres, an in-memory filesystem, or a fake clock. Deepenable if the stand-in exists. The deepened module is tested with the stand-in running in the test suite. The seam can stay internal; no port is needed at the module's external interface unless production also varies.

### 3. Remote but owned

Your own services across a network seam, such as microservices or internal APIs. Define a port at the seam. The deep module owns the logic; the transport is injected as an adapter. Tests use an in-memory adapter. Production uses an HTTP, gRPC, queue, or platform adapter.

Recommendation shape: "Define a port at the seam, implement a production adapter and an in-memory adapter for testing, so the logic sits in one deep module even though it is deployed across a network."

### 4. True external

Third-party services you do not control, such as Stripe or Twilio. The deepened module takes the external dependency as an injected port; tests provide a mock adapter. Extract as much logic as possible into the pure core so the mock is only used for the unavoidable side effect.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Do not introduce a port unless at least two adapters are justified, usually production plus test.
- **Internal seams vs external seams.** A deep module can have internal seams private to its implementation and used by its own tests, as well as the external seam at its interface. Do not expose internal seams through the interface just because tests use them.

## Testing strategy: replace, don't layer

- Old unit tests on shallow modules become waste once tests at the deepened module's interface exist: delete them.
- Write new tests at the deepened module's interface. The **interface is the test surface**.
- Tests assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors. They describe behavior, not implementation.
