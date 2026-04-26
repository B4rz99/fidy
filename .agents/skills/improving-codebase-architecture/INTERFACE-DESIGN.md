# Interface Design

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this parallel sub-agent pattern. Based on "Design It Twice" from Ousterhout: your first idea is unlikely to be the best.

Use the vocabulary in [LANGUAGE.md](LANGUAGE.md): **module**, **interface**, **seam**, **adapter**, **leverage**, and **locality**.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into from [REFERENCE.md](REFERENCE.md) and [DEEPENING.md](DEEPENING.md)
- A rough illustrative code sketch to ground the constraints. This is not a proposal; it only makes the constraints concrete.

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while the sub-agents work in parallel.

### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel. Each must produce a **radically different** interface for the deepened module.

Prompt each sub-agent with a separate technical brief: file paths, coupling details, dependency category, and what sits behind the seam. Include both [LANGUAGE.md](LANGUAGE.md) vocabulary and `CONTEXT.md` vocabulary so each sub-agent names things consistently with the architecture language and the project's domain language.

Give each agent a different design constraint:

- Agent 1: "Minimize the interface: aim for 1-3 entry points max. Maximize leverage per entry point."
- Agent 2: "Maximize flexibility: support many use cases and extension."
- Agent 3: "Optimize for the most common caller: make the default case trivial."
- Agent 4, if applicable: "Design around ports and adapters for cross-seam dependencies."

Each sub-agent outputs:

1. Interface: types, methods, params, invariants, ordering, and error modes
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters
5. Trade-offs: where leverage is high and where it is thin

### 3. Present and compare

Present designs sequentially so the user can absorb each one, then compare them in prose. Contrast by **depth**, **locality**, and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated: the user wants a strong read, not just a menu.
