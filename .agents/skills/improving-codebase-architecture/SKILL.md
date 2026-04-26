---
name: improving-codebase-architecture
description: Explore a codebase to find opportunities for architectural improvement, focusing on making the codebase more testable by deepening shallow modules. Use when user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more AI-navigable.
---

# Improve Codebase Architecture

Explore a codebase like an AI would, surface architectural friction, discover opportunities for improving testability, and propose module-deepening refactors as GitHub issue RFCs.

A **deep module** (John Ousterhout, "A Philosophy of Software Design") has a small interface hiding a large implementation. Deep modules are more testable, more AI-navigable, and let you test at the boundary instead of inside.

## Glossary

Use these terms consistently in every suggestion. Full definitions live in [LANGUAGE.md](LANGUAGE.md).

- **Module**: anything with an interface and an implementation (function, class, package, slice).
- **Interface**: everything a caller must know to use the module correctly: types, invariants, ordering, error modes, config, and performance characteristics.
- **Implementation**: the code inside a module.
- **Depth**: leverage at the interface. **Deep** means a lot of behavior behind a small interface; **shallow** means the interface is nearly as complex as the implementation.
- **Seam**: where an interface lives; a place behavior can be altered without editing in place. Prefer this over "boundary" when discussing architecture.
- **Adapter**: a concrete thing satisfying an interface at a seam.
- **Leverage**: what callers get from depth.
- **Locality**: what maintainers get from depth: change, bugs, knowledge, and verification concentrated in one place.

Key principles:

- **Deletion test**: imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across many callers, it was earning its keep.
- **The interface is the test surface.**
- **One adapter = hypothetical seam. Two adapters = real seam.**
- Prefer the local functional style in [REFERENCE.md](REFERENCE.md): pure cores, immutable data in/out, atomic tests, and effectful shells at infrastructure edges.

This skill is informed by the project's domain model: `CONTEXT.md`, `CONTEXT-MAP.md`, and ADRs. Domain language gives names to good seams; ADRs record decisions the skill should not re-litigate.

## Process

### 1. Explore the codebase

Read existing documentation first:

- `CONTEXT.md` or `CONTEXT-MAP.md` plus each mapped `CONTEXT.md`
- Relevant ADRs in `docs/adr/` and any context-scoped `docs/adr/` directories

If these files don't exist, proceed silently. Don't flag their absence or suggest creating them upfront.

Use `functions.task` with `subagent_type: "explore"` to navigate the codebase naturally. When multiple explorations are independent, launch them in parallel with `multi_tool_use.parallel`. Do NOT follow rigid heuristics - explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small files?
- Where are modules so shallow that the interface is nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called?
- Where do tightly-coupled modules create integration risk in the seams between them?
- Which parts of the codebase are untested, or hard to test?

Apply the **deletion test** to suspected shallow modules: would deleting it concentrate complexity, or just move it around? The friction you encounter IS the signal.

### 2. Present candidates

Present a numbered list of deepening opportunities. For each candidate, show:

- **Files**: Which files/modules are involved
- **Problem**: Why the current architecture is causing friction
- **Solution**: Plain English description of what would change
- **Benefits**: Explained in terms of locality, leverage, and how tests would improve
- **Why they're coupled**: Shared types, call patterns, co-ownership of a concept
- **Dependency category**: See [REFERENCE.md](REFERENCE.md) for the four categories
- **Test impact**: What existing tests would be replaced by boundary tests

Use `CONTEXT.md` vocabulary for the domain and [LANGUAGE.md](LANGUAGE.md) vocabulary for architecture. If a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark the conflict clearly.

Do NOT propose interfaces yet. Ask the user: "Which of these would you like to explore?"

### 3. User picks a candidate

### 4. Grilling loop

Once the user picks a candidate, walk the design tree with them: constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive, and where the pure core ends and the effectful shell begins.

Side effects happen inline as decisions crystallize:

- **Naming a deepened module after a concept not in `CONTEXT.md`?** Add the term to `CONTEXT.md` using the same discipline as `/domain-model`. Create the file lazily if it doesn't exist.
- **Sharpening a fuzzy domain term during the conversation?** Update `CONTEXT.md` right there.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR only when future architecture reviews would need that reason to avoid re-suggesting the same thing.
- **Want to explore alternative interfaces for the deepened module?** Use the parallel design workflow in [INTERFACE-DESIGN.md](INTERFACE-DESIGN.md).

### 5. Frame the problem space

Before launching sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would need to rely on, including their category from [REFERENCE.md](REFERENCE.md) and [DEEPENING.md](DEEPENING.md)
- A rough illustrative code sketch to make the constraints concrete — this is not a proposal, just a way to ground the constraints

Show this to the user, then immediately proceed to Step 6. The user reads and thinks about the problem while the sub-agents work in parallel.

### 6. Design multiple interfaces

Launch 3+ sub-agents in parallel using `functions.task` wrapped by `multi_tool_use.parallel`. Use `subagent_type: "general"` for design generation. Each must produce a **radically different** interface for the deepened module.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency category, what's being hidden). Include both [LANGUAGE.md](LANGUAGE.md) vocabulary and `CONTEXT.md` vocabulary so each design names things consistently. This brief is independent of the user-facing explanation in Step 5. Give each agent a different design constraint:

- Agent 1: "Minimize the interface — aim for 1-3 entry points max. Maximize leverage per entry point."
- Agent 2: "Maximize flexibility — support many use cases and extension"
- Agent 3: "Optimize for the most common caller — make the default case trivial"
- Agent 4 (if applicable): "Design around the ports & adapters pattern for cross-boundary dependencies"

Each sub-agent outputs:

1. Interface signature (types, methods, params, invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What implementation complexity it hides behind the seam
4. Dependency strategy and adapters (how deps are handled — see [REFERENCE.md](REFERENCE.md) and [DEEPENING.md](DEEPENING.md))
5. Trade-offs: where leverage is high and where it is thin

Present designs sequentially, then compare them in prose. Contrast by **depth**, **locality**, and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not just a menu.

### 7. User picks an interface (or accepts recommendation)

### 8. Create GitHub issue

If the user wants the outcome captured as a GitHub issue, create a refactor RFC using `gh issue create`. Use the template in [REFERENCE.md](REFERENCE.md). Otherwise, stop at the recommendation.
