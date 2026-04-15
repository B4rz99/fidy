# Deep Modules

From "A Philosophy of Software Design":

**Deep module** = small interface + lots of implementation

```
┌─────────────────────┐
│   Small Interface   │  ← Few functions, simple params, immutable inputs/outputs
├─────────────────────┤
│                     │
│                     │
│  Deep Implementation│  ← Complex logic hidden, pure where possible
│                     │
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation (avoid)

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

## Functional Core, Imperative Shell

Deep modules pair naturally with this pattern: the pure core is deep (complex
logic, simple data-in/data-out interface) and the shell is thin (just wires
effects to the core).

```
┌─────────────────────┐         ┌─────────────────────┐
│   Pure Core         │         │  Imperative Shell   │
│   (deep module)     │ ──────► │  (thin, effectful)  │
│                     │         │                     │
│  data → data        │         │  calls DB, network  │
│  no side effects    │         │  calls core, done   │
└─────────────────────┘         └─────────────────────┘
```

The pure core is trivially testable without mocks. The shell is too thin to
need unit tests — integration tests cover it.

## When designing interfaces, ask:

- Can I reduce the number of functions?
- Can I simplify the parameters?
- Can I hide more complexity inside?
- Can the inputs and outputs be plain immutable data?
- Can I move effects to the shell, keeping the core pure?
