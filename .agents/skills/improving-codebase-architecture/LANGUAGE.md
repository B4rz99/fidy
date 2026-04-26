# Language

Shared vocabulary for every suggestion this skill makes. Use these terms consistently. Avoid drifting into "component," "service," "API," or "boundary" when the more precise terms below apply.

## Terms

**Module**
Anything with an interface and an implementation. Deliberately scale-agnostic: applies equally to a function, class, package, or tier-spanning slice.
_Avoid_: unit, component, service.

**Interface**
Everything a caller must know to use the module correctly. Includes the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics.
_Avoid_: API, signature, when those would narrow the idea to type-level surface only.

**Implementation**
What's inside a module: its body of code. Distinct from **Adapter**: a thing can be a small adapter with a large implementation, or a large adapter with a small implementation.

**Depth**
Leverage at the interface: the amount of behavior a caller or test can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behavior sits behind a small interface. A module is **shallow** when the interface is nearly as complex as the implementation.

**Seam**
A place where behavior can be altered without editing in that place. The location at which a module's interface lives. Choosing where to put the seam is distinct from deciding what goes behind it.
_Avoid_: boundary, which is overloaded with DDD's bounded context.

**Adapter**
A concrete thing that satisfies an interface at a seam. Describes role, not substance.

**Leverage**
What callers get from depth: more capability per unit of interface they have to learn.

**Locality**
What maintainers get from depth: change, bugs, knowledge, and verification concentrated in one place rather than spread across callers.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts; they just are not part of the external interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, the module was not hiding anything. If complexity reappears across many callers, the module was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you need to test past the interface, the module is probably the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Do not introduce a seam unless something actually varies across it.

## Relationships

- A **Module** has exactly one **Interface**: the surface it presents to callers and tests.
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines**: rewards padding the implementation. Use depth-as-leverage instead.
- **"Interface" as only the TypeScript `interface` keyword or public methods**: too narrow.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or **interface**.
